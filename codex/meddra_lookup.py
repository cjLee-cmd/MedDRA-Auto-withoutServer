#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import sys
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence


LLT_FIELD_COUNT = 12
PT_FIELD_COUNT = 12
MDHIER_FIELD_COUNT = 13

LLT_SYNONYM_HINTS: Dict[str, List[str]] = {
    "빈혈": [
        "피가 모자람",
        "피가 모자름",
        "피 부족",
        "피부족",
        "혈액 부족",
        "혈액부족",
    ],
}


@dataclass
class LltRecord:
    code: str
    name: str
    pt_code: str
    active: bool


@dataclass
class PtRecord:
    code: str
    name: str
    primary_soc_code: str


@dataclass
class Hierarchy:
    pt_code: str
    hlt_code: str
    hlgt_code: str
    soc_code: str
    pt_name: str
    hlt_name: str
    hlgt_name: str
    soc_name: str
    soc_abbrev: str
    primary: bool


class MeddraData:
    def __init__(self, data_root: Path):
        self.data_root = data_root
        self.ascii_dir = data_root / "ascii-281"
        if not self.ascii_dir.exists():
            raise FileNotFoundError(f"ascii-281 디렉터리를 찾을 수 없습니다: {self.ascii_dir}")
        self._llt: Optional[List[LltRecord]] = None
        self._pt: Optional[Dict[str, PtRecord]] = None
        self._hierarchy: Optional[Dict[str, List[Hierarchy]]] = None

    def llt_records(self) -> List[LltRecord]:
        if self._llt is None:
            path = self.ascii_dir / "llt.asc"
            records: List[LltRecord] = []
            with path.open(encoding="utf-8") as fh:
                reader = csv.reader(fh, delimiter="$")
                for row in reader:
                    row = self._pad(row, LLT_FIELD_COUNT)
                    code, name, pt_code = row[0], row[1], row[2]
                    active = (row[9].upper() == "Y")
                    if not code or not name or not pt_code:
                        continue
                    records.append(LltRecord(code=code, name=name, pt_code=pt_code, active=active))
            self._llt = records
        return self._llt

    def pt_records(self) -> Dict[str, PtRecord]:
        if self._pt is None:
            path = self.ascii_dir / "pt.asc"
            mapping: Dict[str, PtRecord] = {}
            with path.open(encoding="utf-8") as fh:
                reader = csv.reader(fh, delimiter="$")
                for row in reader:
                    row = self._pad(row, PT_FIELD_COUNT)
                    code, name = row[0], row[1]
                    primary_soc = row[3]
                    if not code or not name:
                        continue
                    mapping[code] = PtRecord(code=code, name=name, primary_soc_code=primary_soc)
            self._pt = mapping
        return self._pt

    def hierarchy(self) -> Dict[str, List[Hierarchy]]:
        if self._hierarchy is None:
            path = self.ascii_dir / "mdhier.asc"
            mapping: Dict[str, List[Hierarchy]] = {}
            with path.open(encoding="utf-8") as fh:
                reader = csv.reader(fh, delimiter="$")
                for row in reader:
                    row = self._pad(row, MDHIER_FIELD_COUNT)
                    hierarchy = Hierarchy(
                        pt_code=row[0],
                        hlt_code=row[1],
                        hlgt_code=row[2],
                        soc_code=row[3],
                        pt_name=row[4],
                        hlt_name=row[5],
                        hlgt_name=row[6],
                        soc_name=row[7],
                        soc_abbrev=row[8],
                        primary=(row[11].upper() == "Y"),
                    )
                    mapping.setdefault(hierarchy.pt_code, []).append(hierarchy)
            self._hierarchy = mapping
        return self._hierarchy

    @staticmethod
    def _pad(row: Sequence[str], size: int) -> List[str]:
        padded = list(row)
        if len(padded) < size:
            padded.extend([""] * (size - len(padded)))
        return padded

    def search_llt(self, query: str, limit: int, include_inactive: bool) -> List[Dict[str, str]]:
        q = query.casefold()
        results: List[Dict[str, str]] = []
        pts = self.pt_records()
        hier_map = self.hierarchy()
        for record in self.llt_records():
            if not include_inactive and not record.active:
                continue
            if q not in record.name.casefold():
                continue
            pt = pts.get(record.pt_code)
            if not pt:
                continue
            hier_list = hier_map.get(pt.code, [])
            hier = self._select_primary(hier_list)
            score = self._compute_score(q, record.name, record.active)
            hierarchies = self._build_hierarchy_payload(hier_list)
            results.append(
                self._build_result(
                    record=record,
                    pt=pt,
                    hier=hier,
                    hierarchies=hierarchies,
                    score=score,
                )
            )
        results.sort(key=lambda item: (
            -item["score"],
            0 if item["active"] == "Y" else 1,
            item["llt_name"].casefold(),
        ))
        return results[:limit]

    def search_approximate_llt(self, query: str, limit: int, include_inactive: bool) -> List[Dict[str, str]]:
        q_norm = self._normalize(query)
        if not q_norm:
            return []
        pts = self.pt_records()
        hier_map = self.hierarchy()
        scored: List[Dict[str, str]] = []
        for record in self.llt_records():
            if not include_inactive and not record.active:
                continue
            pt = pts.get(record.pt_code)
            if not pt:
                continue
            name_norm = self._normalize(record.name)
            if not name_norm:
                continue
            variants = [name_norm]
            for synonym in LLT_SYNONYM_HINTS.get(record.name, []):
                syn_norm = self._normalize(synonym)
                if syn_norm:
                    variants.append(syn_norm)
            ratio = 0.0
            for variant in variants:
                current = SequenceMatcher(None, q_norm, variant).ratio()
                if q_norm in variant:
                    current += 0.15
                elif variant.startswith(q_norm) or q_norm.startswith(variant):
                    current += 0.1
                ratio = max(ratio, current)
            if ratio < 0.25:
                continue
            score = min(100.0, ratio * 100 + (5 if record.active else 0))
            hier_list = hier_map.get(pt.code, [])
            hier = self._select_primary(hier_list)
            hierarchies = self._build_hierarchy_payload(hier_list)
            scored.append(
                self._build_result(
                    record=record,
                    pt=pt,
                    hier=hier,
                    hierarchies=hierarchies,
                    score=score,
                )
            )
        scored.sort(
            key=lambda item: (
                -item.get("score", 0),
                0 if item["active"] == "Y" else 1,
                len(item["llt_name"]),
            )
        )
        return scored[:limit]

    @staticmethod
    def _select_primary(hierarchies: Iterable[Hierarchy]) -> Optional[Hierarchy]:
        primary = None
        fallback = None
        for item in hierarchies:
            fallback = item if fallback is None else fallback
            if item.primary:
                primary = item
                break
        return primary or fallback

    @staticmethod
    def _normalize(value: str) -> str:
        return "".join(value.casefold().split())

    @staticmethod
    def _build_hierarchy_payload(hier_list: Iterable[Hierarchy]) -> List[Dict[str, str]]:
        payload = []
        for item in hier_list:
            payload.append(
                {
                    "primary": "Y" if item.primary else "N",
                    "hlt_code": item.hlt_code,
                    "hlt_name": item.hlt_name,
                    "hlgt_code": item.hlgt_code,
                    "hlgt_name": item.hlgt_name,
                    "soc_code": item.soc_code,
                    "soc_name": item.soc_name,
                }
            )
        return payload

    @staticmethod
    def _build_result(
        record: LltRecord,
        pt: PtRecord,
        hier: Optional[Hierarchy],
        hierarchies: List[Dict[str, str]],
        score: Optional[float] = None,
    ) -> Dict[str, Any]:
        result: Dict[str, Any] = {
            "llt_code": record.code,
            "llt_name": record.name,
            "pt_code": pt.code,
            "pt_name": pt.name,
            "active": "Y" if record.active else "N",
            "soc_code": hier.soc_code if hier else pt.primary_soc_code,
            "soc_name": hier.soc_name if hier else "",
            "hlgt_name": hier.hlgt_name if hier else "",
            "hlt_name": hier.hlt_name if hier else "",
            "soc_abbrev": hier.soc_abbrev if hier else "",
            "primary_soc": "Y" if hier and hier.primary else ("" if not hier else "N"),
            "hierarchies": hierarchies,
        }
        if score is not None:
            result["score"] = float(score)
        return result

    @staticmethod
    def _compute_score(query_cf: str, name: str, active: bool) -> int:
        candidate_cf = name.casefold()
        pos = candidate_cf.find(query_cf)
        if pos < 0:
            return 0
        length_diff = abs(len(candidate_cf) - len(query_cf))
        position_penalty = min(pos * 6, 45)
        length_penalty = min(length_diff * 2, 35)
        inactive_penalty = 20 if not active else 0
        base = 100
        score = base - position_penalty - length_penalty - inactive_penalty
        return max(5, score)


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="MedDRA 28.1 한국어판 LLT/PT 계층 검색 도구",
    )
    parser.add_argument("query", nargs="?", help="검색할 증상 또는 용어 조각")
    parser.add_argument("-n", "--limit", type=int, default=10, help="표시할 최대 결과 수")
    parser.add_argument(
        "--include-inactive",
        action="store_true",
        help="비활성화된 LLT 용어도 결과에 포함",
    )
    parser.add_argument(
        "--data-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="MedDRA 데이터가 위치한 루트 디렉터리 (ascii-281 하위 포함)",
    )
    return parser


def format_result(item: Dict[str, str]) -> str:
    lines = [
        f"LLT {item['llt_code']}: {item['llt_name']} (활성={item['active']})",
        f"  PT  {item['pt_code']}: {item['pt_name']}",
    ]
    hierarchy_parts = []
    if item.get("soc_name"):
        hierarchy_parts.append(f"SOC {item['soc_code']}: {item['soc_name']}")
    if item.get("hlgt_name"):
        hierarchy_parts.append(f"HLGT: {item['hlgt_name']}")
    if item.get("hlt_name"):
        hierarchy_parts.append(f"HLT: {item['hlt_name']}")
    if hierarchy_parts:
        lines.append("  " + " | ".join(hierarchy_parts))
    if item.get("soc_abbrev"):
        lines.append(f"  SOC 약어: {item['soc_abbrev']}")
    if item.get("primary_soc"):
        lines.append(f"  Primary SOC 지정: {item['primary_soc']}")
    return "\n".join(lines)


def interactive_loop(dataset: MeddraData, limit: int, include_inactive: bool) -> None:
    print("MedDRA 증상 검색을 시작합니다. 종료하려면 Ctrl+C 또는 빈 줄 입력.")
    try:
        while True:
            query = input("검색어> ").strip()
            if not query:
                break
            results = dataset.search_llt(query, limit=limit, include_inactive=include_inactive)
            if not results:
                print("  결과가 없습니다.")
                continue
            for idx, item in enumerate(results, start=1):
                print(f"[{idx}]\n{format_result(item)}")
    except KeyboardInterrupt:
        print("\n종료합니다.")


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    try:
        dataset = MeddraData(args.data_root)
    except FileNotFoundError as exc:
        parser.error(str(exc))
        return 2

    if not args.query:
        interactive_loop(dataset, limit=args.limit, include_inactive=args.include_inactive)
        return 0

    results = dataset.search_llt(args.query, limit=args.limit, include_inactive=args.include_inactive)
    if not results:
        print("검색 결과가 없습니다.")
        return 1
    for idx, item in enumerate(results, start=1):
        print(f"[{idx}]\n{format_result(item)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

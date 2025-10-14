#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence


LLT_FIELD_COUNT = 12
PT_FIELD_COUNT = 12
MDHIER_FIELD_COUNT = 13


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
            results.append(
                {
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
                }
            )
        results.sort(key=lambda item: (
            0 if item["active"] == "Y" else 1,
            item["llt_name"].casefold().find(q),
            len(item["llt_name"]),
        ))
        return results[:limit]

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

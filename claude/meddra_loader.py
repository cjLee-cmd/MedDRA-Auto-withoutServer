#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MedDRA 데이터 로더 모듈

MedDRA 파일(LLT, PT, Hierarchy)을 로드하고 검색 기능을 제공합니다.
"""

from typing import Dict, List, Optional
import os


class LLTLoader:
    """LLT(최하위 용어) 데이터 로더"""

    def __init__(self, llt_file: str):
        """
        Args:
            llt_file: llt.asc 파일 경로
        """
        self.llt_dict = {}  # llt_code -> info
        self.llt_name_dict = {}  # llt_name -> [llt_codes]
        self.pt_to_llts = {}  # pt_code -> [llt_codes]
        self._load(llt_file)

    def _load(self, llt_file: str):
        """LLT 파일 로드"""
        if not os.path.exists(llt_file):
            raise FileNotFoundError(f"LLT 파일을 찾을 수 없습니다: {llt_file}")

        print(f"Loading LLT data from {llt_file}...")
        count = 0

        with open(llt_file, 'r', encoding='utf-8') as f:
            for line in f:
                fields = line.strip().split('$')

                llt_code = fields[0]
                llt_name = fields[1]
                pt_code = fields[2]
                llt_currency = fields[9] if len(fields) > 9 else 'N'

                # 현재 사용 중인 용어만 저장
                if llt_currency == 'Y':
                    self.llt_dict[llt_code] = {
                        'llt_name': llt_name,
                        'pt_code': pt_code,
                        'llt_currency': llt_currency
                    }

                    # 이름으로 검색을 위한 인덱스
                    if llt_name not in self.llt_name_dict:
                        self.llt_name_dict[llt_name] = []
                    self.llt_name_dict[llt_name].append(llt_code)

                    # PT별 LLT 매핑
                    if pt_code not in self.pt_to_llts:
                        self.pt_to_llts[pt_code] = []
                    self.pt_to_llts[pt_code].append(llt_code)

                    count += 1

        print(f"✓ Loaded {count} active LLTs")

    def search_by_name(self, keyword: str) -> List[Dict]:
        """
        용어명으로 검색 (부분 일치)

        Args:
            keyword: 검색 키워드

        Returns:
            매칭된 LLT 정보 리스트
        """
        results = []
        keyword_lower = keyword.lower()

        for llt_code, info in self.llt_dict.items():
            if keyword_lower in info['llt_name'].lower():
                results.append({
                    'llt_code': llt_code,
                    'llt_name': info['llt_name'],
                    'pt_code': info['pt_code']
                })

        return results

    def get_llts_by_pt(self, pt_code: str) -> List[str]:
        """PT 코드로 모든 LLT 조회"""
        return self.pt_to_llts.get(pt_code, [])

    def get_llt_info(self, llt_code: str) -> Optional[Dict]:
        """LLT 코드로 정보 조회"""
        return self.llt_dict.get(llt_code)


class PTLoader:
    """PT(선호 용어) 데이터 로더"""

    def __init__(self, pt_file: str):
        """
        Args:
            pt_file: pt.asc 파일 경로
        """
        self.pt_dict = {}  # pt_code -> info
        self._load(pt_file)

    def _load(self, pt_file: str):
        """PT 파일 로드"""
        if not os.path.exists(pt_file):
            raise FileNotFoundError(f"PT 파일을 찾을 수 없습니다: {pt_file}")

        print(f"Loading PT data from {pt_file}...")
        count = 0

        with open(pt_file, 'r', encoding='utf-8') as f:
            for line in f:
                fields = line.strip().split('$')

                pt_code = fields[0]
                pt_name = fields[1]
                pt_soc_code = fields[3] if len(fields) > 3 else ''

                self.pt_dict[pt_code] = {
                    'pt_name': pt_name,
                    'pt_soc_code': pt_soc_code
                }
                count += 1

        print(f"✓ Loaded {count} PTs")

    def get_pt_info(self, pt_code: str) -> Optional[Dict]:
        """PT 정보 조회"""
        return self.pt_dict.get(pt_code)

    def search_by_name(self, keyword: str) -> List[Dict]:
        """PT명으로 검색 (부분 일치)"""
        results = []
        keyword_lower = keyword.lower()

        for pt_code, info in self.pt_dict.items():
            if keyword_lower in info['pt_name'].lower():
                results.append({
                    'pt_code': pt_code,
                    'pt_name': info['pt_name'],
                    'soc_code': info['pt_soc_code']
                })

        return results


class HierarchyLoader:
    """MedDRA 계층 정보 로더"""

    def __init__(self, mdhier_file: str):
        """
        Args:
            mdhier_file: mdhier.asc 파일 경로
        """
        self.hierarchy_dict = {}  # pt_code -> {primary, secondary}
        self.soc_dict = {}  # soc_code -> [pt_codes]
        self._load(mdhier_file)

    def _load(self, mdhier_file: str):
        """mdhier 파일 로드"""
        if not os.path.exists(mdhier_file):
            raise FileNotFoundError(f"Hierarchy 파일을 찾을 수 없습니다: {mdhier_file}")

        print(f"Loading hierarchy data from {mdhier_file}...")
        count = 0

        with open(mdhier_file, 'r', encoding='utf-8') as f:
            for line in f:
                fields = line.strip().split('$')

                pt_code = fields[0]
                hlt_code = fields[1]
                hlgt_code = fields[2]
                soc_code = fields[3]
                pt_name = fields[4]
                hlt_name = fields[5]
                hlgt_name = fields[6]
                soc_name = fields[7]
                soc_abbrev = fields[8] if len(fields) > 8 else ''
                primary_soc_flag = fields[11] if len(fields) > 11 else 'N'

                # PT 코드별 계층 정보
                if pt_code not in self.hierarchy_dict:
                    self.hierarchy_dict[pt_code] = {
                        'primary': None,
                        'secondary': []
                    }

                hierarchy_info = {
                    'pt_code': pt_code,
                    'pt_name': pt_name,
                    'hlt_code': hlt_code,
                    'hlt_name': hlt_name,
                    'hlgt_code': hlgt_code,
                    'hlgt_name': hlgt_name,
                    'soc_code': soc_code,
                    'soc_name': soc_name,
                    'soc_abbrev': soc_abbrev
                }

                if primary_soc_flag == 'Y':
                    self.hierarchy_dict[pt_code]['primary'] = hierarchy_info
                else:
                    self.hierarchy_dict[pt_code]['secondary'].append(hierarchy_info)

                # SOC별 PT 매핑
                if primary_soc_flag == 'Y':
                    if soc_code not in self.soc_dict:
                        self.soc_dict[soc_code] = []
                    if pt_code not in self.soc_dict[soc_code]:
                        self.soc_dict[soc_code].append(pt_code)

                count += 1

        print(f"✓ Loaded {count} hierarchy records")

    def get_hierarchy(self, pt_code: str, primary_only: bool = True) -> Optional[Dict]:
        """
        PT 코드의 계층 정보 조회

        Args:
            pt_code: PT 코드
            primary_only: Primary SOC만 반환할지 여부

        Returns:
            계층 정보 딕셔너리 또는 None
        """
        if pt_code not in self.hierarchy_dict:
            return None

        if primary_only:
            return self.hierarchy_dict[pt_code]['primary']
        else:
            return self.hierarchy_dict[pt_code]

    def get_pts_by_soc(self, soc_code: str) -> List[str]:
        """특정 SOC의 모든 PT 찾기"""
        return self.soc_dict.get(soc_code, [])


if __name__ == '__main__':
    # 테스트 코드
    data_dir = '../ascii-281'

    # 로더 초기화
    llt_loader = LLTLoader(f'{data_dir}/llt.asc')
    pt_loader = PTLoader(f'{data_dir}/pt.asc')
    hier_loader = HierarchyLoader(f'{data_dir}/mdhier.asc')

    # 테스트 검색
    print("\n=== 테스트: '두통' 검색 ===")
    results = llt_loader.search_by_name('두통')
    print(f"매칭된 LLT: {len(results)}개")
    for r in results[:5]:
        print(f"  - {r['llt_name']} (LLT: {r['llt_code']}, PT: {r['pt_code']})")

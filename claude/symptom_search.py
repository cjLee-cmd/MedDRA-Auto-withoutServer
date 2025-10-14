#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MedDRA 증상 검색 시스템

환자 증상을 입력하면 관련 MedDRA 코드와 계층 정보를 반환합니다.
"""

from typing import Dict, List, Optional
from meddra_loader import LLTLoader, PTLoader, HierarchyLoader


class SymptomSearch:
    """증상 검색 시스템"""

    def __init__(self, data_dir: str = '../ascii-281'):
        """
        Args:
            data_dir: MedDRA 데이터 파일이 있는 디렉토리 경로
        """
        print("=" * 60)
        print("MedDRA 증상 검색 시스템 초기화 중...")
        print("=" * 60)

        self.llt_loader = LLTLoader(f'{data_dir}/llt.asc')
        self.pt_loader = PTLoader(f'{data_dir}/pt.asc')
        self.hier_loader = HierarchyLoader(f'{data_dir}/mdhier.asc')

        print("\n✓ 초기화 완료!\n")

    def search(self, symptom: str, show_related: bool = False) -> List[Dict]:
        """
        증상으로 MedDRA 코드 검색

        Args:
            symptom: 증상 텍스트 (예: "두통", "복통")
            show_related: 관련 증상도 함께 표시할지 여부

        Returns:
            검색 결과 리스트
        """
        if not symptom or not symptom.strip():
            return []

        results = []

        # 1. LLT 검색
        llt_matches = self.llt_loader.search_by_name(symptom.strip())

        # 2. 각 LLT에 대해 PT 및 계층 정보 조회
        seen_pts = set()  # 중복 제거용

        for llt in llt_matches:
            pt_code = llt['pt_code']

            # 이미 처리한 PT는 스킵
            if pt_code in seen_pts:
                continue
            seen_pts.add(pt_code)

            # PT 정보 조회
            pt_info = self.pt_loader.get_pt_info(pt_code)
            if not pt_info:
                continue

            # 계층 정보 조회 (Primary SOC만)
            hierarchy = self.hier_loader.get_hierarchy(pt_code, primary_only=True)
            if not hierarchy:
                continue

            result = {
                'llt_code': llt['llt_code'],
                'llt_name': llt['llt_name'],
                'pt_code': pt_code,
                'pt_name': pt_info['pt_name'],
                'hierarchy': hierarchy
            }

            # 관련 증상 추가
            if show_related:
                result['related_symptoms'] = self._get_related_symptoms(pt_code)

            results.append(result)

        return results

    def _get_related_symptoms(self, pt_code: str, limit: int = 5) -> List[Dict]:
        """
        같은 HLT의 관련 증상 찾기

        Args:
            pt_code: PT 코드
            limit: 반환할 최대 개수

        Returns:
            관련 증상 리스트
        """
        hierarchy = self.hier_loader.get_hierarchy(pt_code)
        if not hierarchy:
            return []

        hlt_code = hierarchy['hlt_code']

        # 같은 HLT의 다른 PT들 찾기
        related = []
        count = 0

        for pt, info in self.hier_loader.hierarchy_dict.items():
            if count >= limit:
                break

            primary = info.get('primary')
            if primary and primary['hlt_code'] == hlt_code and pt != pt_code:
                pt_info = self.pt_loader.get_pt_info(pt)
                if pt_info:
                    related.append({
                        'pt_code': pt,
                        'pt_name': pt_info['pt_name']
                    })
                    count += 1

        return related

    def get_details(self, pt_code: str) -> Optional[Dict]:
        """
        PT 코드로 상세 정보 조회

        Args:
            pt_code: PT 코드

        Returns:
            상세 정보 딕셔너리
        """
        pt_info = self.pt_loader.get_pt_info(pt_code)
        if not pt_info:
            return None

        hierarchy_full = self.hier_loader.get_hierarchy(pt_code, primary_only=False)
        if not hierarchy_full:
            return None

        # 해당 PT의 모든 LLT 찾기
        llts = self.llt_loader.get_llts_by_pt(pt_code)
        llt_details = []
        for llt_code in llts[:10]:  # 최대 10개
            llt_info = self.llt_loader.get_llt_info(llt_code)
            if llt_info:
                llt_details.append({
                    'llt_code': llt_code,
                    'llt_name': llt_info['llt_name']
                })

        return {
            'pt_code': pt_code,
            'pt_name': pt_info['pt_name'],
            'primary_hierarchy': hierarchy_full['primary'],
            'secondary_hierarchies': hierarchy_full['secondary'],
            'llts': llt_details,
            'related_symptoms': self._get_related_symptoms(pt_code, limit=10)
        }


def format_search_results(results: List[Dict], detailed: bool = False) -> str:
    """
    검색 결과를 보기 좋게 포맷팅

    Args:
        results: 검색 결과 리스트
        detailed: 상세 정보 표시 여부

    Returns:
        포맷팅된 문자열
    """
    if not results:
        return "검색 결과가 없습니다."

    output = []
    output.append(f"\n{'=' * 70}")
    output.append(f"총 {len(results)}개의 결과를 찾았습니다.")
    output.append(f"{'=' * 70}\n")

    for idx, result in enumerate(results, 1):
        hierarchy = result['hierarchy']

        output.append(f"[결과 {idx}]")
        output.append(f"  LLT: {result['llt_name']} (코드: {result['llt_code']})")
        output.append(f"  ↓")
        output.append(f"  PT:  {result['pt_name']} (코드: {result['pt_code']})")
        output.append("")
        output.append(f"  📋 전체 계층 구조:")
        output.append(f"     SOC:  {hierarchy['soc_name']} ({hierarchy['soc_abbrev']}, {hierarchy['soc_code']})")
        output.append(f"       ↓")
        output.append(f"     HLGT: {hierarchy['hlgt_name']} ({hierarchy['hlgt_code']})")
        output.append(f"       ↓")
        output.append(f"     HLT:  {hierarchy['hlt_name']} ({hierarchy['hlt_code']})")
        output.append(f"       ↓")
        output.append(f"     PT:   {hierarchy['pt_name']} ({hierarchy['pt_code']})")

        # 관련 증상 표시
        if detailed and 'related_symptoms' in result and result['related_symptoms']:
            output.append("")
            output.append(f"  🔗 관련 증상 (같은 HLT):")
            for related in result['related_symptoms']:
                output.append(f"     • {related['pt_name']} ({related['pt_code']})")

        output.append(f"\n{'-' * 70}\n")

    return "\n".join(output)


def format_details(details: Dict) -> str:
    """
    상세 정보를 보기 좋게 포맷팅

    Args:
        details: 상세 정보 딕셔너리

    Returns:
        포맷팅된 문자열
    """
    if not details:
        return "정보를 찾을 수 없습니다."

    output = []
    output.append(f"\n{'=' * 70}")
    output.append(f"PT 상세 정보: {details['pt_name']} ({details['pt_code']})")
    output.append(f"{'=' * 70}\n")

    # Primary 계층
    primary = details['primary_hierarchy']
    output.append("📋 Primary 계층 구조:")
    output.append(f"   SOC:  {primary['soc_name']} ({primary['soc_abbrev']}, {primary['soc_code']})")
    output.append(f"     ↓")
    output.append(f"   HLGT: {primary['hlgt_name']} ({primary['hlgt_code']})")
    output.append(f"     ↓")
    output.append(f"   HLT:  {primary['hlt_name']} ({primary['hlt_code']})")
    output.append(f"     ↓")
    output.append(f"   PT:   {primary['pt_name']} ({primary['pt_code']})")

    # Secondary 계층
    if details['secondary_hierarchies']:
        output.append("\n📋 Secondary 계층 구조:")
        for idx, secondary in enumerate(details['secondary_hierarchies'], 1):
            output.append(f"\n   [{idx}] SOC: {secondary['soc_name']} ({secondary['soc_abbrev']})")

    # LLT 목록
    if details['llts']:
        output.append(f"\n📝 관련 LLT (최하위 용어) - 총 {len(details['llts'])}개:")
        for llt in details['llts']:
            output.append(f"   • {llt['llt_name']} ({llt['llt_code']})")

    # 관련 증상
    if details['related_symptoms']:
        output.append(f"\n🔗 관련 증상 (같은 HLT) - 총 {len(details['related_symptoms'])}개:")
        for related in details['related_symptoms']:
            output.append(f"   • {related['pt_name']} ({related['pt_code']})")

    output.append(f"\n{'=' * 70}\n")

    return "\n".join(output)


if __name__ == '__main__':
    # 테스트 코드
    search_system = SymptomSearch()

    # 테스트 검색
    print("테스트 1: '두통' 검색")
    results = search_system.search('두통', show_related=True)
    print(format_search_results(results, detailed=True))

    if results:
        print("\n테스트 2: 첫 번째 PT의 상세 정보")
        pt_code = results[0]['pt_code']
        details = search_system.get_details(pt_code)
        print(format_details(details))

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MedDRA 데이터를 JSON으로 내보내기

웹 애플리케이션에서 사용할 수 있도록 데이터를 JSON 형식으로 변환합니다.
"""

import json
from meddra_loader import LLTLoader, PTLoader, HierarchyLoader


def export_to_json(data_dir='../ascii-281', output_file='meddra_data.json'):
    """
    MedDRA 데이터를 JSON 파일로 내보내기

    Args:
        data_dir: MedDRA 데이터 디렉토리
        output_file: 출력 JSON 파일명
    """
    print("=" * 60)
    print("MedDRA 데이터를 JSON으로 변환 중...")
    print("=" * 60)

    # 데이터 로드
    llt_loader = LLTLoader(f'{data_dir}/llt.asc')
    pt_loader = PTLoader(f'{data_dir}/pt.asc')
    hier_loader = HierarchyLoader(f'{data_dir}/mdhier.asc')

    print("\n데이터 변환 중...")

    # LLT 데이터 변환
    llt_data = []
    for llt_code, info in llt_loader.llt_dict.items():
        llt_data.append({
            'llt_code': llt_code,
            'llt_name': info['llt_name'],
            'pt_code': info['pt_code']
        })

    # PT 데이터 변환
    pt_data = {}
    for pt_code, info in pt_loader.pt_dict.items():
        pt_data[pt_code] = {
            'pt_name': info['pt_name'],
            'pt_soc_code': info['pt_soc_code']
        }

    # 계층 데이터 변환 (Primary만)
    hierarchy_data = {}
    for pt_code, info in hier_loader.hierarchy_dict.items():
        if info['primary']:
            hierarchy_data[pt_code] = {
                'pt_code': info['primary']['pt_code'],
                'pt_name': info['primary']['pt_name'],
                'hlt_code': info['primary']['hlt_code'],
                'hlt_name': info['primary']['hlt_name'],
                'hlgt_code': info['primary']['hlgt_code'],
                'hlgt_name': info['primary']['hlgt_name'],
                'soc_code': info['primary']['soc_code'],
                'soc_name': info['primary']['soc_name'],
                'soc_abbrev': info['primary']['soc_abbrev']
            }

    # JSON 파일로 저장
    data = {
        'version': '28.1',
        'language': 'Korean',
        'llt': llt_data,
        'pt': pt_data,
        'hierarchy': hierarchy_data
    }

    print(f"\nJSON 파일로 저장 중: {output_file}")
    print(f"  - LLT: {len(llt_data):,}개")
    print(f"  - PT: {len(pt_data):,}개")
    print(f"  - Hierarchy: {len(hierarchy_data):,}개")

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # 파일 크기 확인
    import os
    file_size = os.path.getsize(output_file) / (1024 * 1024)
    print(f"\n✓ 완료! 파일 크기: {file_size:.1f} MB")
    print(f"✓ 저장 위치: {output_file}")


if __name__ == '__main__':
    export_to_json()

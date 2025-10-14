#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MedDRA 증상 검색 CLI (Command Line Interface)

사용자가 증상을 입력하면 관련 MedDRA 코드와 정보를 출력합니다.
"""

import sys
import argparse
from symptom_search import SymptomSearch, format_search_results, format_details


def interactive_mode(search_system: SymptomSearch):
    """대화형 모드"""
    print("\n" + "=" * 70)
    print("MedDRA 증상 검색 시스템 - 대화형 모드")
    print("=" * 70)
    print("\n명령어:")
    print("  - 증상 입력: 검색할 증상을 입력하세요 (예: 두통, 복통)")
    print("  - 'detail <PT코드>': PT 코드의 상세 정보 조회")
    print("  - 'help': 도움말 표시")
    print("  - 'quit' 또는 'exit': 종료")
    print("\n" + "=" * 70 + "\n")

    while True:
        try:
            # 사용자 입력
            user_input = input("증상 입력 > ").strip()

            if not user_input:
                continue

            # 종료 명령
            if user_input.lower() in ['quit', 'exit', 'q']:
                print("\n종료합니다. 감사합니다!\n")
                break

            # 도움말
            if user_input.lower() in ['help', 'h', '?']:
                print("\n사용 가능한 명령어:")
                print("  - 증상 입력 (예: 두통, 복통, 어지러움)")
                print("  - detail <PT코드> (예: detail 10019211)")
                print("  - help: 이 도움말 표시")
                print("  - quit: 종료\n")
                continue

            # 상세 정보 조회
            if user_input.lower().startswith('detail '):
                pt_code = user_input[7:].strip()
                details = search_system.get_details(pt_code)
                print(format_details(details))
                continue

            # 증상 검색
            results = search_system.search(user_input, show_related=True)

            if not results:
                print(f"\n'{user_input}'에 대한 검색 결과가 없습니다.")
                print("다른 키워드로 시도해보세요.\n")
            else:
                print(format_search_results(results, detailed=True))

                # PT 코드 목록 표시
                if len(results) > 1:
                    print("💡 상세 정보를 보려면 'detail <PT코드>'를 입력하세요.")
                    print("   예: detail " + results[0]['pt_code'] + "\n")

        except KeyboardInterrupt:
            print("\n\n종료합니다. 감사합니다!\n")
            break
        except Exception as e:
            print(f"\n오류 발생: {e}")
            print("다시 시도해주세요.\n")


def single_search_mode(search_system: SymptomSearch, symptom: str, show_related: bool = False):
    """단일 검색 모드"""
    results = search_system.search(symptom, show_related=show_related)

    if not results:
        print(f"\n'{symptom}'에 대한 검색 결과가 없습니다.\n")
        return

    print(format_search_results(results, detailed=show_related))


def detail_mode(search_system: SymptomSearch, pt_code: str):
    """상세 정보 조회 모드"""
    details = search_system.get_details(pt_code)
    print(format_details(details))


def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(
        description='MedDRA 증상 검색 시스템',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
사용 예시:
  # 대화형 모드 (권장)
  python meddra_cli.py

  # 단일 검색
  python meddra_cli.py -s "두통"

  # 관련 증상 포함 검색
  python meddra_cli.py -s "복통" -r

  # PT 코드로 상세 정보 조회
  python meddra_cli.py -d 10019211

  # 데이터 경로 지정
  python meddra_cli.py -p /path/to/ascii-281 -s "어지러움"
        """
    )

    parser.add_argument(
        '-s', '--search',
        metavar='SYMPTOM',
        help='검색할 증상 (예: "두통", "복통")'
    )

    parser.add_argument(
        '-d', '--detail',
        metavar='PT_CODE',
        help='상세 정보를 조회할 PT 코드 (예: 10019211)'
    )

    parser.add_argument(
        '-r', '--related',
        action='store_true',
        help='관련 증상도 함께 표시'
    )

    parser.add_argument(
        '-p', '--path',
        default='../ascii-281',
        metavar='PATH',
        help='MedDRA 데이터 디렉토리 경로 (기본: ../ascii-281)'
    )

    args = parser.parse_args()

    # 검색 시스템 초기화
    try:
        search_system = SymptomSearch(data_dir=args.path)
    except FileNotFoundError as e:
        print(f"\n오류: {e}")
        print("데이터 파일 경로를 확인해주세요. (-p 옵션으로 경로 지정 가능)\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n초기화 오류: {e}\n")
        sys.exit(1)

    # 모드 선택
    if args.detail:
        # 상세 정보 조회 모드
        detail_mode(search_system, args.detail)
    elif args.search:
        # 단일 검색 모드
        single_search_mode(search_system, args.search, show_related=args.related)
    else:
        # 대화형 모드 (기본)
        interactive_mode(search_system)


if __name__ == '__main__':
    main()

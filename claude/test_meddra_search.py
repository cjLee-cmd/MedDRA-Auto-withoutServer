"""
MedDRA 웹 애플리케이션 E2E 테스트
Playwright를 사용하여 '두통' 검색 기능 테스트
"""

from playwright.sync_api import sync_playwright, expect
import time

def test_meddra_search():
    with sync_playwright() as p:
        # 브라우저 실행 (헤드리스 모드 비활성화 - 탭 유지)
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()

        # 콘솔 로그 캡처
        console_messages = []
        page.on("console", lambda msg: console_messages.append(f"[{msg.type}] {msg.text}"))

        print("✅ 브라우저 실행 완료")

        # 페이지 이동
        print("🌐 http://localhost:8000 접속 중...")
        page.goto("http://localhost:8000")
        page.wait_for_load_state("networkidle")

        print("✅ 페이지 로드 완료")

        # 페이지 타이틀 확인
        title = page.title()
        print(f"📄 페이지 타이틀: {title}")

        # 데이터 로딩 완료 대기 (최대 10초)
        print("⏳ 데이터 로딩 대기 중...")
        page.wait_for_selector('#searchInput', state='visible', timeout=10000)

        # 로딩 인디케이터가 사라질 때까지 대기
        loading = page.locator('#loadingIndicator')
        if loading.is_visible():
            print("⏳ 데이터 로딩 중...")
            page.wait_for_selector('#loadingIndicator', state='hidden', timeout=30000)

        print("✅ 데이터 로딩 완료")

        # 검색창 찾기
        search_input = page.locator('#searchInput')
        expect(search_input).to_be_visible()
        print("✅ 검색창 발견")

        # '두통' 입력
        print("⌨️  '두통' 입력 중...")
        search_input.fill("두통")

        # 입력 값 확인
        input_value = search_input.input_value()
        print(f"✅ 입력 완료: '{input_value}'")

        # 검색 버튼 클릭
        print("🔍 검색 버튼 클릭...")
        search_btn = page.locator('#searchBtn')
        search_btn.click()

        # 결과 섹션이 표시될 때까지 대기
        print("⏳ 검색 결과 대기 중...")
        page.wait_for_selector('#resultsSection', state='visible', timeout=10000)
        time.sleep(1)

        # 스크린샷 먼저 저장
        screenshot_path = "test_result_두통_정확.png"
        page.screenshot(path=screenshot_path)
        print(f"📸 스크린샷 저장: {screenshot_path}")

        # ===== 정확한 검증 시작 =====
        print("\n🔍 정확한 결과 검증 시작...\n")

        # 1. "검색 결과가 없습니다" 메시지 확인
        no_results_message = page.locator('text="검색 결과가 없습니다"')
        has_no_results = no_results_message.is_visible()

        print(f"1️⃣ '검색 결과가 없습니다' 메시지 존재: {has_no_results}")

        # 2. 결과 컨테이너 내용 확인
        results_container = page.locator('#resultsContainer')
        container_text = results_container.inner_text()
        print(f"2️⃣ 결과 컨테이너 텍스트 (첫 300자):\n{container_text[:300]}\n")

        # 3. 실제 결과 아이템 개수 확인
        result_items = page.locator('#resultsContainer > div')
        result_count = result_items.count()
        print(f"3️⃣ #resultsContainer > div 요소 개수: {result_count}")

        # ===== 최종 판정 =====
        if has_no_results:
            print("\n" + "="*60)
            print("❌❌❌ 테스트 실패! ❌❌❌")
            print("="*60)
            print("실패 이유: '검색 결과가 없습니다' 메시지가 표시됨")
            print("실제 데이터: 없음")
            print("="*60)
            test_success = False

        elif "검색 결과가 없습니다" in container_text or "다른 검색어를 시도" in container_text:
            print("\n" + "="*60)
            print("❌❌❌ 테스트 실패! ❌❌❌")
            print("="*60)
            print("실패 이유: 결과 컨테이너에 '결과 없음' 메시지 포함")
            print(f"컨테이너 내용:\n{container_text}")
            print("="*60)
            test_success = False

        elif result_count > 0:
            # 첫 번째 결과 상세 확인
            first_result = result_items.first
            first_text = first_result.inner_text()

            print(f"\n4️⃣ 첫 번째 결과 상세:\n{first_text[:400]}\n")

            if "검색 결과가 없습니다" in first_text:
                print("\n" + "="*60)
                print("❌❌❌ 테스트 실패! ❌❌❌")
                print("="*60)
                print("실패 이유: 첫 번째 결과에 '결과 없음' 메시지 포함")
                print("="*60)
                test_success = False
            else:
                print("\n" + "="*60)
                print("✅✅✅ 테스트 성공! ✅✅✅")
                print("="*60)
                print(f"검색어: '두통'")
                print(f"결과 개수: {result_count}개")
                print(f"실제 데이터: 존재함")
                print("="*60)
                test_success = True

        else:
            print("\n" + "="*60)
            print("❌❌❌ 테스트 실패! ❌❌❌")
            print("="*60)
            print("실패 이유: 결과 요소를 찾을 수 없음")
            print("="*60)
            test_success = False

        # 브라우저 콘솔 로그 출력
        print("\n" + "="*60)
        print("📋 브라우저 콘솔 로그:")
        print("="*60)
        for msg in console_messages:
            print(msg)
        print("="*60)

        print("\n⚠️  탭을 닫지 않고 유지합니다. 수동으로 확인하세요.")
        print("💡 브라우저를 수동으로 닫아주세요.")

        # 브라우저 유지 (60초 대기 후 자동 종료)
        print("\n⏰ 60초 후 자동으로 브라우저가 닫힙니다...")
        time.sleep(60)

        # 정리
        context.close()
        browser.close()
        print("\n👋 테스트 완료")

if __name__ == "__main__":
    test_meddra_search()

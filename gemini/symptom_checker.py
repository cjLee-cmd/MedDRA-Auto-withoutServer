
import csv
import sys
import os

def search_symptom(search_term):
    # Construct the absolute path to the CSV file
    # The script is in gemini/, the data is also in gemini/
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        csv_file_path = os.path.join(script_dir, 'meddra_terms.csv')
    except NameError:
        # Fallback for interactive environments where __file__ is not defined
        script_dir = os.path.abspath('gemini')
        csv_file_path = os.path.join(script_dir, 'meddra_terms.csv')


    results = []
    try:
        with open(csv_file_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader) # Skip header row
            for row in reader:
                # row is [Code, Term, Level]
                if search_term.lower() in row[1].lower():
                    results.append(row)
    except FileNotFoundError:
        print(f"오류: 'meddra_terms.csv' 파일을 찾을 수 없습니다. 이 스크립트와 동일한 'gemini' 폴더에 파일이 있는지 확인하세요.")
        return
    except Exception as e:
        print(f"파일을 읽는 중 오류가 발생했습니다: {e}")
        return

    if results:
        print(f"\n'{search_term}'에 대한 검색 결과:")
        # Print header
        print(f"{'Code':<12} {'Level':<5} {'Term'}")
        print("-" * 50)
        # Print results
        for row in results:
            print(f"{row[0]:<12} {row[2]:<5} {row[1]}")
    else:
        print(f"\n'{search_term}'에 대한 검색 결과를 찾을 수 없습니다.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법: python3 gemini/symptom_checker.py \"<검색할 증상>\"")
        sys.exit(1)
    
    symptom_to_search = sys.argv[1]
    search_symptom(symptom_to_search)

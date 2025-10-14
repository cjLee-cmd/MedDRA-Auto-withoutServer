
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const resultsBody = document.getElementById('resultsBody');
    const noResults = document.getElementById('noResults');
    const resultsTable = document.getElementById('resultsTable');

    let meddraData = [];

    // Initially disable search controls
    searchInput.disabled = true;
    searchButton.disabled = true;
    searchInput.placeholder = "데이터를 불러오는 중...";

    // Fetch the JSON data
    fetch('meddra_terms.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            meddraData = data;
            console.log("MedDRA data loaded successfully.");
            // Enable controls after data is loaded
            searchInput.disabled = false;
            searchButton.disabled = false;
            searchInput.placeholder = "증상을 입력하세요...";
        })
        .catch(error => {
            console.error("Error loading MedDRA data:", error);
            searchInput.placeholder = "데이터 로딩 실패!";
            resultsBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:red;">데이터를 불러오는 데 실패했습니다.</td></tr>';
        });

    const performSearch = () => {
        const searchTerm = searchInput.value.toLowerCase();
        resultsBody.innerHTML = ''; // Clear previous results

        if (!searchTerm) {
            noResults.classList.add('hidden');
            resultsTable.classList.remove('hidden');
            return;
        }

        const filteredResults = meddraData.filter(item => 
            item.Term.toLowerCase().includes(searchTerm)
        );

        if (filteredResults.length === 0) {
            resultsTable.classList.add('hidden');
            noResults.classList.remove('hidden');
        } else {
            resultsTable.classList.remove('hidden');
            noResults.classList.add('hidden');
            filteredResults.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.Code}</td>
                    <td>${item.Term}</td>
                    <td>${item.Level}</td>
                `;
                resultsBody.appendChild(row);
            });
        }
    };

    searchButton.addEventListener('click', performSearch);

    searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            performSearch();
        }
    });
});

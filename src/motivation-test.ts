interface Question {
    question: string;
    low: string;
    high: string;
}

interface MotivationTest {
    language: string;
    curiosity: Question[];
    honor: Question[];
    acceptance: Question[];
    mastery: Question[];
    power: Question[];
    freedom: Question[];
    relatedness: Question[];
    order: Question[];
    goal: Question[];
    status: Question[];
    [key: string]: string | Question[];
}

let currentCategoryIndex: number = 0;
let currentQuestionIndex: number = 0;
let answers: { [category: string]: number[] } = {};
let categories: string[] = [];
const secretKey = 'dont give up, keep trying, try it from the other side.';

document.addEventListener('DOMContentLoaded', async () => {
    const questionElement = document.getElementById('question') as HTMLParagraphElement;
    const categoryElement = document.getElementById('category') as HTMLParagraphElement;
    const circlesContainer = document.getElementById('circles-container') as HTMLDivElement;
    const testData: MotivationTest = await fetchTestData();
    categories = Object.keys(testData).filter(key => key !== 'language');
    categories.forEach(category => answers[category] = []);

    const lowLabel = document.getElementById('low') as HTMLSpanElement;
    const highLabel = document.getElementById('high') as HTMLSpanElement;

    const nextBtn = document.getElementById('nextBtn') as HTMLButtonElement;

    const urlParams = new URLSearchParams(window.location.search);
    const encryptedResult = urlParams.get('result');

    nextBtn.addEventListener('click', () => {
        const currentCategory = categories[currentCategoryIndex];
        
        answers[currentCategory].push(parseInt(circlesContainer.dataset.selected || "0"));
        currentQuestionIndex++;

        if (currentQuestionIndex < (testData[currentCategory] as Question[]).length) {
            showQuestion(testData, currentCategory, currentQuestionIndex);
        } else {
            currentQuestionIndex = 0;
            currentCategoryIndex++;

            if (currentCategoryIndex < categories.length) {
                showQuestion(testData, categories[currentCategoryIndex], currentQuestionIndex);
            } else {
                submitResults();
            }
        }
    });

    if (encryptedResult) {
        try {
            const decryptedData = JSON.parse(decrypt(encryptedResult));
            answers = decryptedData;
            
            showResult();
            return;
        } catch (error) {
            console.error('Failed to decrypt data:', error);
            startTest();
        }
    } else {
        startTest();
    } 

    async function fetchTestData(): Promise<MotivationTest> {
        return fetch('/assets/js/data/motivation-test.json')
            .then(response => response.json())
            .then(data => {
                let result = data[0];
                return result;
            });
        }

    function startTest() {
        showQuestion(testData, categories[currentCategoryIndex], currentQuestionIndex);
    }

    function showQuestion(testData: MotivationTest, category: string, index: number) {
        const selected_question = testData[category][index] as Question;
        categoryElement.textContent = category;
        questionElement.textContent = selected_question.question;
        lowLabel.textContent = selected_question.low;
        highLabel.textContent = selected_question.high;
        circlesContainer.innerHTML = '';
        for (let i = 1; i <= 7; i++) {
            const circle = document.createElement('div');
            circle.className = 'answer-circle';
            let raduis: number = (i <= 4) ? 50 - i * 5 : 10 + i * 5;
            circle.style.width = `${raduis}px`;
            circle.style.height = `${raduis}px`;
            circle.style.backgroundColor = getColor(i);
            circle.dataset.value = i.toString();
            circle.addEventListener('click', () => selectAnswer(i));
            circlesContainer.appendChild(circle);
        }
    }

    function showResult() {
        const resultDiv = document.getElementById('result') as HTMLDivElement;
        const questionsSpan = document.getElementById('questions-part') as HTMLSpanElement;
        resultDiv.style.display='block';
        questionsSpan.style.display='none';

        const scores: { [category: string]: number } = {};

        categories.forEach(category => {
            const categoryAnswers = answers[category];
            const average = categoryAnswers.reduce((acc, curr) => acc + curr, 0) / categoryAnswers.length;
            scores[category] = Number((Math.round(average * 100) / 100).toFixed(2));
        });
        
        renderChart(scores);

        const hashSpan = document.getElementById('result-hash') as HTMLSpanElement;
        if (encryptedResult) {
            hashSpan.innerHTML = encryptedResult;
        }

        localStorage.setItem('motivationTestResult', JSON.stringify(answers));
    }

    function selectAnswer(value: number) {
        const circles = document.querySelectorAll('.answer-circle') as NodeListOf<HTMLDivElement>;
        circles.forEach(circle => {
            if (parseInt(circle.dataset.value || "0") === value) {
                circle.style.border = '2px solid black';
                circlesContainer.dataset.selected = value.toString();
            } else {
                circle.style.border = 'none';
            }
        });
        nextBtn.click();
    }

    function getColor(value: number): string {
        const red = 255 - (value - 1) * 28;
        const green = (value - 1) * 28;
        return `rgb(${red}, ${green}, 0, 0.5)`;
    }

    function submitResults() {
        localStorage.setItem('motivationTestResult', JSON.stringify(answers));
        const encryptedResult = encrypt(JSON.stringify(answers));
        const newUrl = `${window.location.pathname}?result=${encryptedResult}`;
        window.history.replaceState({}, '', newUrl);
        showResult();
    }

    function encrypt(plainText: string){
        var b64 = CryptoJS.AES.encrypt(plainText, secretKey).toString();
        var e64 = CryptoJS.enc.Base64.parse(b64);
        var eHex = e64.toString(CryptoJS.enc.Hex);
        return eHex;
    }
    
    function decrypt(cipherText: string){
       var reb64 = CryptoJS.enc.Hex.parse(cipherText);
       var bytes = reb64.toString(CryptoJS.enc.Base64);
       var decrypt = CryptoJS.AES.decrypt(bytes, secretKey);
       var plain = decrypt.toString(CryptoJS.enc.Utf8);
       return plain;
    }

    function renderChart(scores: { [category: string]: number }) {
        const ctx = document.getElementById('result-chart') as HTMLCanvasElement;
        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: Object.keys(scores),
                datasets: [{
                    label: 'Motivation Scores',
                    data: Object.values(scores),
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    r: {
                        max: 7,
                        min: 0,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    /**
     * Recursively collects all values from an object.
     * @param obj - The object to collect values from.
     * @returns An array of values.
     */
    function getAllValues(obj: any): any[] {
        let values: any[] = [];
        
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                if (typeof value === 'object' && !Array.isArray(value)) {
                    values = values.concat(getAllValues(value));
                } else {
                    values.push(value);
                }
            }
        }

        return values;
    }
});

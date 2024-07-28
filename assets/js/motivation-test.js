import MotivationTest from './motivationTestQuestions.js';
import { CryptoUser } from './cryptoUser.js';
const notSoSecretKey = 'dont give up, keep trying, try it from the other side.';
let cryptoUser = new CryptoUser;
document.addEventListener('DOMContentLoaded', async () => {
    await cryptoUser.createAsync();
    const questionElement = document.getElementById('question');
    const categoryElement = document.getElementById('category');
    const circlesContainer = document.getElementById('circles-container');
    let testData = new MotivationTest();
    testData = await testData.createAsync('en');
    const totalQuestions = testData.totalQuestions();
    const lowLabel = document.getElementById('low');
    const highLabel = document.getElementById('high');
    const nextBtn = document.getElementById('nextBtn');
    const urlParams = new URLSearchParams(window.location.search);
    let encryptedResult = urlParams.get('result');
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    if (cryptoUser.address) {
        try {
            connectWalletBtn.textContent = cryptoUser.address;
            if (cryptoUser.encryptedTestResults.length > 0) {
                console.log("encryptedResults", cryptoUser.encryptedTestResults);
            }
            else {
                startTest();
            }
        }
        catch (error) {
            console.error('Error reading test result:', error);
        }
    }
    const writeResultBtn = document.getElementById('writeResultBtn');
    const readResultBtn = document.getElementById('readResultBtn');
    const withdrawFundsBtn = document.getElementById('withdrawFunds');
    writeResultBtn === null || writeResultBtn === void 0 ? void 0 : writeResultBtn.addEventListener('click', async () => {
        const amount = document.getElementById('paymentAmount').value;
        if (encryptedResult && amount) {
            console.log("writeTestResult.encryptedResult:", encryptedResult);
            await cryptoUser.writeTestResult(encryptedResult, amount);
        }
    });
    readResultBtn === null || readResultBtn === void 0 ? void 0 : readResultBtn.addEventListener('click', () => {
        if (cryptoUser) {
            cryptoUser.readTestResults();
        }
        else {
            console.log("Please connect wallet first.");
        }
    });
    withdrawFundsBtn === null || withdrawFundsBtn === void 0 ? void 0 : withdrawFundsBtn.addEventListener('click', async () => {
        if (cryptoUser) {
            await cryptoUser.withdrawFunds();
        }
        else {
            console.log("Please connect wallet first.");
        }
    });
    if (encryptedResult) {
        try {
            const decryptedData = JSON.parse(decrypt(encryptedResult));
            testData.answers = decryptedData;
            showResult();
            return;
        }
        catch (error) {
            console.error('Failed to decrypt data:', error);
            startTest();
        }
    }
    else {
        startTest();
    }
    nextBtn.addEventListener('click', () => {
        testData.addAnswer(parseInt(circlesContainer.dataset.selected || "0"));
        updateProgressBar(testData.overallQuestionsIndex, totalQuestions);
        if (testData.currentCategoryIndex < testData.categories.length) {
            showQuestion(testData);
        }
        else {
            showResult();
        }
    });
    function startTest() {
        showQuestion(testData);
        updateProgressBar(0, totalQuestions);
    }
    function showQuestion(testData) {
        const selected_question = testData.currentQuestion();
        categoryElement.textContent = capitalizeFirstLetter(testData.currentCategory());
        questionElement.textContent = selected_question.question;
        lowLabel.textContent = selected_question.low;
        highLabel.textContent = selected_question.high;
        circlesContainer.innerHTML = '';
        for (let i = 1; i <= 7; i++) {
            const circle = document.createElement('div');
            circle.className = 'answer-circle';
            let raduis = (i <= 4) ? 50 - i * 5 : 10 + i * 5;
            circle.style.width = `${raduis}px`;
            circle.style.height = `${raduis}px`;
            circle.style.backgroundColor = getColor(i);
            circle.dataset.value = i.toString();
            circle.addEventListener('click', () => selectAnswer(i));
            circlesContainer.appendChild(circle);
        }
    }
    function updateProgressBar(currentQuestionIndex, totalQuestions) {
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        const progressPercentage = ((currentQuestionIndex / totalQuestions) * 100).toFixed(2);
        progressBar.style.width = `${progressPercentage}%`;
        progressText.textContent = `Questions Remaining: ${totalQuestions - currentQuestionIndex} / ${totalQuestions}`;
    }
    function showResult() {
        const resultDiv = document.getElementById('result');
        const questionsSpan = document.getElementById('questions-part');
        const resultText = document.getElementById('result-text');
        resultDiv.style.display = 'block';
        questionsSpan.style.display = 'none';
        const scores = {};
        let htmlTextResutls = '';
        testData.categories.forEach(category => {
            const categoryAnswers = testData.answers[category];
            const average = categoryAnswers.reduce((acc, curr) => acc + curr, 0) / categoryAnswers.length;
            scores[category] = Number((Math.round(average * 100) / 100).toFixed(2));
        });
        const categoriesSortedByResult = Object.keys(scores).sort(function (a, b) { return scores[b] - scores[a]; });
        categoriesSortedByResult.forEach((category) => {
            htmlTextResutls += `
            <span class="text-result top-${8 - Math.round(scores[category])}">
                ${capitalizeFirstLetter(category)}: ${Number(Math.round(100 * scores[category]) / 7).toFixed(0)}%
            </span>`;
        });
        resultText.innerHTML = htmlTextResutls;
        renderChart(scores);
        const hashSpan = document.getElementById('result-hash');
        if (encryptedResult) {
            hashSpan.innerHTML = encryptedResult;
        }
    }
    function selectAnswer(value) {
        const circles = document.querySelectorAll('.answer-circle');
        circles.forEach(circle => {
            if (parseInt(circle.dataset.value || "0") === value) {
                circle.style.border = '2px solid black';
                circlesContainer.dataset.selected = value.toString();
            }
            else {
                circle.style.border = 'none';
            }
        });
        nextBtn.click();
    }
    function getColor(value) {
        const red = 255 - (value - 1) * 28;
        const green = (value - 1) * 28;
        return `rgb(${red}, ${green}, 0, 0.5)`;
    }
    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
    }
    function submitResults() {
        const time = { time: Date.now() };
        const answersWithTime = Object.assign(Object.assign({}, time), testData.answers);
        localStorage.setItem('motivationTestResult', JSON.stringify(answersWithTime));
        encryptedResult = encrypt(JSON.stringify(answersWithTime));
        if (cryptoUser) {
            console.log("cryptoUser: ", cryptoUser);
        }
        const newUrl = `${window.location.pathname}?result=${encryptedResult}`;
        window.history.replaceState({}, '', newUrl);
        showResult();
    }
    function encrypt(plainText) {
        var b64 = CryptoJS.AES.encrypt(plainText, notSoSecretKey).toString();
        var e64 = CryptoJS.enc.Base64.parse(b64);
        var eHex = e64.toString(CryptoJS.enc.Hex);
        return eHex;
    }
    function decrypt(cipherText) {
        var reb64 = CryptoJS.enc.Hex.parse(cipherText);
        var bytes = reb64.toString(CryptoJS.enc.Base64);
        var decrypt = CryptoJS.AES.decrypt(bytes, notSoSecretKey);
        var plain = decrypt.toString(CryptoJS.enc.Utf8);
        return plain;
    }
    function renderChart(scores) {
        const ctx = document.getElementById('result-chart');
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
                        grid: {
                            circular: true,
                            color: "#003366",
                            // drawTicks: false
                        },
                        max: 7,
                        min: 0,
                        ticks: {
                            display: false
                        },
                    }
                }
            }
        });
    }
});

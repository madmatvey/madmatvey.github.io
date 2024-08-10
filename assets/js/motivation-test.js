import MotivationTest from './motivationTestQuestions.js';
import { CryptoUser } from './cryptoUser.js';
import { motivationTestAnswers } from './motivationTestAnswers.js';
let cryptoUser = new CryptoUser;
let cryptoUser2 = new CryptoUser;
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
    const address = urlParams.get('address');
    const index = parseInt(urlParams.get('index') || "-1");
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    if (cryptoUser.address) {
        try {
            connectWalletBtn.textContent = cryptoUser.address;
            if (cryptoUser.encryptedTestResults.length > 0) {
                const resultsDivHtml = document.getElementById('results');
                resultsDivHtml.style.display = 'block';
                let htmlTextResutls = '';
                cryptoUser.encryptedTestResults.forEach((encryptedResult, index) => {
                    let testAnswers = new motivationTestAnswers;
                    testAnswers.decrypt(encryptedResult);
                    if (testAnswers.isValid()) {
                        htmlTextResutls += `<p><a href="/motivation-test/?address=${cryptoUser.address}&index=${index}">`;
                        testAnswers.sortedCategories().forEach(category => {
                            htmlTextResutls += `
                            <span>
                                ${category}: ${testAnswers.result[category]}%
                            </span>`;
                        });
                        htmlTextResutls += `</a></p>`;
                    }
                });
                resultsDivHtml.innerHTML = htmlTextResutls;
            }
            else {
                startTest();
            }
        }
        catch (error) {
            console.error('Error reading test result:', error);
        }
        return;
    }
    else if (address && index >= 0) {
        await cryptoUser2.createAsync();
        await cryptoUser2.readTestResults(address);
        encryptedResult = cryptoUser2.encryptedTestResults[index];
        showResult();
    }
    const writeResultBtn = document.getElementById('writeResultBtn');
    const withdrawFundsBtn = document.getElementById('withdrawFunds');
    writeResultBtn === null || writeResultBtn === void 0 ? void 0 : writeResultBtn.addEventListener('click', async () => {
        const amount = document.getElementById('paymentAmount').value;
        if (encryptedResult && amount) {
            await cryptoUser.writeTestResult(encryptedResult, amount);
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
            let testAnswers = new motivationTestAnswers;
            testAnswers.decrypt(encryptedResult);
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
            // showResult();
            submitLocalResults();
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
        let testAnswers = new motivationTestAnswers;
        if (encryptedResult) {
            testAnswers.decrypt(encryptedResult);
            testAnswers.sortedCategories().forEach(category => {
                htmlTextResutls += `
                <span class="text-result top-${testAnswers.result7Score(category)}">
                    ${capitalizeFirstLetter(category)}: ${testAnswers.result[category]}%
                </span>`;
            });
        }
        resultText.innerHTML = htmlTextResutls;
        renderChart(testAnswers.result);
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
    function submitLocalResults() {
        encryptedResult = testData.answers.encrypt();
        if (cryptoUser) {
            console.log("cryptoUser: ", cryptoUser);
        }
        const newUrl = `${window.location.pathname}?result=${encryptedResult}`;
        window.history.replaceState({}, '', newUrl);
        showResult();
    }
    function renderChart(scores) {
        const ctx = document.getElementById('result-chart');
        // Destroy existing chart if it exists
        const existingChart = Chart.getChart(ctx);
        if (existingChart) {
            existingChart.destroy();
        }
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
                        },
                        max: 100,
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

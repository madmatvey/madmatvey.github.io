import MotivationTest from './motivationTestQuestions.js'
import { CryptoUser } from './cryptoUser.js';
import { Question } from './question.js'
import { motivationTestAnswers } from './motivationTestAnswers.js';
import { renderChart } from './renderChart.js';

let cryptoUser: CryptoUser = new CryptoUser;
let cryptoUser2: CryptoUser = new CryptoUser;

document.addEventListener('DOMContentLoaded', async () => {
    await cryptoUser.createAsync();
    const questionElement = document.getElementById('question') as HTMLParagraphElement;
    const categoryElement = document.getElementById('category') as HTMLParagraphElement;
    const circlesContainer = document.getElementById('circles-container') as HTMLDivElement;
    
    let testData = new MotivationTest();
    testData = await testData.createAsync('en');
    const totalQuestions = testData.totalQuestions();

    const lowLabel = document.getElementById('low') as HTMLSpanElement;
    const highLabel = document.getElementById('high') as HTMLSpanElement;

    const nextBtn = document.getElementById('nextBtn') as HTMLButtonElement;

    const urlParams = new URLSearchParams(window.location.search);
    let encryptedResult = urlParams.get('result');
    const address = urlParams.get('address');
    const index = parseInt(urlParams.get('index') || "-1");

    const connectWalletBtn = document.getElementById('connectWalletBtn') as HTMLButtonElement;
    
    if (cryptoUser.address) {
        try {
            connectWalletBtn.textContent = cryptoUser.address;
            if (cryptoUser.encryptedTestResults.length > 0) {
                const resultsDivHtml = document.getElementById('results') as HTMLDivElement;
                resultsDivHtml.style.display='block';
                let htmlTextResutls: string = '';
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
                resultsDivHtml.innerHTML = htmlTextResutls
            } else {
                startTest();
            }
        } catch (error) {
            console.error('Error reading test result:', error);
        }
        return;
    } else if (address && index >= 0) {
        await cryptoUser2.createAsync();
        await cryptoUser2.readTestResults(address);
        encryptedResult = cryptoUser2.encryptedTestResults[index];
        showResult();
    }
  
    const writeResultBtn = document.getElementById('writeResultBtn');
    const withdrawFundsBtn = document.getElementById('withdrawFunds');

    writeResultBtn?.addEventListener('click', async () => {        
        const amount = (document.getElementById('paymentAmount') as HTMLInputElement).value;
        if (encryptedResult && amount) {
            await cryptoUser.writeTestResult(encryptedResult, amount);
        }
    });

    withdrawFundsBtn?.addEventListener('click', async () => {
        if (cryptoUser) {
            await cryptoUser.withdrawFunds();
        } else {
            console.log("Please connect wallet first.");
        }
    });

    if (encryptedResult) {
        try {
            let testAnswers = new motivationTestAnswers;
            testAnswers.decrypt(encryptedResult);
            
            showResult();
            return;
        } catch (error) {
            console.error('Failed to decrypt data:', error);
            startTest();
        }
    } else {
        startTest();
    }

    nextBtn.addEventListener('click', () => {
        testData.addAnswer(parseInt(circlesContainer.dataset.selected || "0"));
        updateProgressBar(testData.overallQuestionsIndex, totalQuestions);
        if (testData.currentCategoryIndex < testData.categories.length) {
            showQuestion(testData);
        } else {
            // showResult();
            submitLocalResults();
        }

    });

    function startTest() {
        showQuestion(testData);
        updateProgressBar(0, totalQuestions);
    }

    function showQuestion(testData: MotivationTest) {
        const selected_question = testData.currentQuestion() as Question;
        categoryElement.textContent = capitalizeFirstLetter(testData.currentCategory());
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

    function updateProgressBar(currentQuestionIndex: number, totalQuestions: number) {
        const progressBar = document.getElementById('progress-bar') as HTMLDivElement;
        const progressText = document.getElementById('progress-text') as HTMLParagraphElement;
        const progressPercentage = ((currentQuestionIndex / totalQuestions) * 100).toFixed(2);
        
        progressBar.style.width = `${progressPercentage}%`;
        progressText.textContent = `Questions Remaining: ${totalQuestions - currentQuestionIndex} / ${totalQuestions}`;
    }

    function showResult() {    
        const resultDiv = document.getElementById('result') as HTMLDivElement;
        const questionsSpan = document.getElementById('questions-part') as HTMLSpanElement;
        const resultText = document.getElementById('result-text') as HTMLSpanElement;

        resultDiv.style.display='block';
        questionsSpan.style.display='none';
        let htmlTextResutls: string = '';
        let testAnswers = new motivationTestAnswers;
        if(encryptedResult) {
            testAnswers.decrypt(encryptedResult);
            testAnswers.sortedCategories().forEach(category => {
                htmlTextResutls += `
                <span class="text-result top-${ testAnswers.result7Score(category) }">
                    ${ capitalizeFirstLetter(category) }: ${ testAnswers.result[category] }%
                </span>`;
            });
        }
        
        resultText.innerHTML = htmlTextResutls;
        
        renderChart(testAnswers.result);

        const hashSpan = document.getElementById('result-hash') as HTMLSpanElement;
        if (encryptedResult) {
            hashSpan.innerHTML = encryptedResult;
        }
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

    function capitalizeFirstLetter(string: string) {
        return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase().replace(/_/g, " ");
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
});
// import abi from "./motivation-test-contract-abi.json";
// import { ethers } from "ethers";
// import Chart from "chart.js/auto";

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
let overallQuestionsIndex: number = 0;
let answers: { [category: string]: number[]  } = {};
let categories: string[] = [];
const secretKey = 'dont give up, keep trying, try it from the other side.';

const contractAddress = "0x438cFd691017711468fcE90c57907A7d637A5033";
let userAddress: string | null = null;
let abi: any = null;

async function fetchABI() {
    try {
        const response = await fetch('/assets/js/motivation-test-contract-abi.json');
        abi = await response.json();
    } catch (error) {
        console.error('Error fetching ABI:', error);
    }
}

async function connectWallet(): Promise<void> {
    if ((window as any).ethereum) {
        try {
            await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();
            userAddress = await signer.getAddress();
            console.log("Wallet connected, address:", userAddress);
        } catch (error) {
            console.error("Error connecting wallet:", error);
        }
    } else {
        console.log("Please install MetaMask!");
    }
}

async function writeTestResult(hash: string | null, amount: string | null): Promise<void> {
    if (!userAddress) {
        console.log("Please connect wallet first.");
        return;
    }

    if (!hash) {
        console.log("Can't write null result to blockchain");
        return;
    }

    if (!amount) {
        console.log("Can't write zero value, sorry! We need to develop motivation test dapp :)");
        return;
    }
    console.log("writeTestResult.hash:", hash);
    
    try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(contractAddress, abi, signer);
        const tx = await contract.writeTestResult(hash, {
            value: ethers.parseEther(amount), // User specifies the amount of ETH to send
        });
        await tx.wait();
        console.log('Test result written:', hash);
    } catch (error) {
        console.error('Error writing test result:', error);
    }
}

async function readTestResults(address: string): Promise<string[]> {
    try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const results = await contract.readTestResults(address);
        console.log(`Test results for address ${address}:`, results);
        return results;
    } catch (error) {
        console.error('Error reading test result:', error);
        return [];
    }
}

async function withdrawFunds(): Promise<void> {
    await fetchABI();
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);
    
    try {
        console.log('Contract:', contract);
        const owner = await contract.owner(); // Прямой вызов метода owner
        console.log('Owner:', owner);
        const signerAddress = await signer.getAddress();
        console.log('Signer Address:', signerAddress);
    
        if (signerAddress.toLowerCase() !== owner.toLowerCase()) {
          throw new Error("Only the contract owner can withdraw funds");
        }
      const tx = await contract.withdrawFunds();
      await tx.wait();
      console.log('Funds withdrawn successfully');
    } catch (error) {
      console.error('Error withdrawing funds:', error);
    }
  }

async function checkContractBalance(): Promise<void> {
  const provider = new ethers.BrowserProvider((window as any).ethereum);
  const balance = await provider.getBalance(contractAddress);
  console.log(`Contract balance: ${ethers.formatEther(balance)} ETH`);
}

document.addEventListener('DOMContentLoaded', async () => {
    await fetchABI();
    const questionElement = document.getElementById('question') as HTMLParagraphElement;
    const categoryElement = document.getElementById('category') as HTMLParagraphElement;
    const circlesContainer = document.getElementById('circles-container') as HTMLDivElement;
    
    let testData: MotivationTest = await fetchTestData();
    categories = Object.keys(testData).filter(key => key !== 'language');
    categories.forEach(category => answers[category] = []);
    const totalQuestions = Object.values(testData).reduce((sum, questions) => sum + questions.length, 0);

    const lowLabel = document.getElementById('low') as HTMLSpanElement;
    const highLabel = document.getElementById('high') as HTMLSpanElement;

    const nextBtn = document.getElementById('nextBtn') as HTMLButtonElement;

    const urlParams = new URLSearchParams(window.location.search);
    let encryptedResult = urlParams.get('result');

    const connectWalletBtn = document.getElementById('connectWalletBtn') as HTMLButtonElement;
    connectWalletBtn.addEventListener('click', async () => {
        await connectWallet();
        console.log("connectWalletBtn.userAddress: ", userAddress);
        
        if (userAddress) {
            try {
                const results: string[] = await readTestResults(userAddress);
                if (results.length > 0) {
                    // encryptedResult = results[results.length-1];
                    // console.log("encryptedResult:", encryptedResult);
                    // showResult();
                    return;
                }
            } catch (error) {
                console.error('Error reading test result:', error);
            }
        }
        startTest();
    });

    const writeResultBtn = document.getElementById('writeResultBtn');
    const readResultBtn = document.getElementById('readResultBtn');
    const withdrawFundsBtn = document.getElementById('withdrawFunds');

    writeResultBtn?.addEventListener('click', async () => {        
        const amount = (document.getElementById('paymentAmount') as HTMLInputElement).value;
        if (encryptedResult && amount) {
            console.log("writeTestResult.encryptedResult:", encryptedResult);
            await writeTestResult(encryptedResult, amount);
        }
    });
    readResultBtn?.addEventListener('click', () => {
        if (userAddress) {
            readTestResults(userAddress);
        } else {
            console.log("Please connect wallet first.");
        }
    });

    withdrawFundsBtn?.addEventListener('click', async () => {
        if (userAddress) {
            await withdrawFunds();
        } else {
            console.log("Please connect wallet first.");
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

    nextBtn.addEventListener('click', () => {
        const currentCategory = categories[currentCategoryIndex];
        
        answers[currentCategory].push(parseInt(circlesContainer.dataset.selected || "0"));
        currentQuestionIndex++;
        overallQuestionsIndex++;
        updateProgressBar(overallQuestionsIndex, totalQuestions);

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

    async function fetchTestData(): Promise<MotivationTest> {        
        return fetch(`/assets/js/data/motivation-test/motivation-test-questions-en.json`)
            .then(response => response.json())
            .then(data => {
                let result = data[0];
                return result;
            });
        }

    function startTest() {
        showQuestion(testData, categories[currentCategoryIndex], currentQuestionIndex);
        updateProgressBar(0, totalQuestions);
    }

    function showQuestion(testData: MotivationTest, category: string, index: number) {
        const selected_question = testData[category][index] as Question;
        categoryElement.textContent = capitalizeFirstLetter(category);
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

        const scores: { [category: string]: number } = {};
        let htmlTextResutls: string = '';

        categories.forEach(category => {
            const categoryAnswers = answers[category];
            const average = categoryAnswers.reduce((acc, curr) => acc + curr, 0) / categoryAnswers.length;
            scores[category] = Number((Math.round(average * 100) / 100).toFixed(2));
        });
        const categoriesSortedByResult = Object.keys(scores).sort(function(a,b){return scores[b]-scores[a]})
        categoriesSortedByResult.forEach((category) => {
            htmlTextResutls += `
            <span class="text-result top-${8 - Math.round(scores[category])}">
                ${capitalizeFirstLetter(category)}: ${Number(Math.round(100 * scores[category]) / 7).toFixed(0)}%
            </span>`;
        });
        
        resultText.innerHTML = htmlTextResutls;
        
        renderChart(scores);

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
        return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
      }

    function submitResults() {
        const time = { time:  Date.now() };
        const answersWithTime = { ...time, ...answers }
        localStorage.setItem('motivationTestResult', JSON.stringify(answersWithTime));
        encryptedResult = encrypt(JSON.stringify(answersWithTime));
        if (userAddress) {
            console.log("userAddress: ", userAddress);
        }
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

const videoElement = document.getElementById("video");
const startBtn = document.getElementById("startBtn");
const statusText = document.getElementById("status");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const ppgDataElement = document.getElementById("ppgData");

let mediaRecorder;
let chunks = [];
let rawPPG = [];
let timeStamps = []; // Array to hold timestamps for the x-axis of the plot
let ppgChart;

// Initialize the chart
function initializePPGChart() {
    const ctx = document.getElementById('ppgChart').getContext('2d');
    ppgChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeStamps, // X-axis data (time stamps)
            datasets: [{
                label: 'Real-time PPG Signal',
                data: rawPPG, // Y-axis data (PPG signal)
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                fill: true
            }]
        },
        options: {
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'Time (ms)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Signal (Intensity)'
                    }
                }
            }
        }
    });
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });

        videoElement.srcObject = stream;

        // Enable Flashlight (Torch)
        const [track] = stream.getVideoTracks();
        const capabilities = track.getCapabilities();

        if (capabilities.torch) {
            await track.applyConstraints({ advanced: [{ torch: true }] });
            console.log("Flashlight ON");
        } else {
            console.warn("Torch is not supported on this device.");
        }

        // Setup MediaRecorder
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (event) => chunks.push(event.data);

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: "video/mp4" });
            const url = URL.createObjectURL(blob);
            console.log("Video recorded:", url);
            processVideoFrames(stream);
            chunks = [];
        };

    } catch (error) {
        console.error("Error accessing camera:", error);
    }
}

function processVideoFrames(stream) {
    const track = stream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(track);

    rawPPG = [];
    timeStamps = [];

    let startTime = Date.now();  // To track the real time elapsed

    function captureFrame() {
        const elapsedTime = Date.now() - startTime; // Time elapsed in milliseconds

        // Only capture frames from the 3rd second to the 13th second
        if (elapsedTime >= 3000 && elapsedTime <= 13000) {
            imageCapture.grabFrame().then((imageBitmap) => {
                canvas.width = imageBitmap.width;
                canvas.height = imageBitmap.height;
                ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

                const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                let totalRed = 0, pixelCount = frameData.data.length / 4;

                for (let i = 0; i < frameData.data.length; i += 4) {
                    totalRed += frameData.data[i];  // Extract Red Channel
                }

                let avgRed = totalRed / pixelCount;
                rawPPG.push(avgRed);

                // Record time in ms for the x-axis
                timeStamps.push(elapsedTime);

                ppgDataElement.innerText = rawPPG.join(", ");

                // Update the chart with the new PPG data
                updatePPGChart(timeStamps, rawPPG);
            }).catch(error => console.error("Frame capture error:", error));
        }
    }

    let frameCaptureInterval = setInterval(captureFrame, 100);  // Capture every 100ms

    setTimeout(() => {
        clearInterval(frameCaptureInterval);
        console.log("PPG Signal Extraction Complete");
        statusText.innerText = "PPG Signal Extraction Complete";
    }, 15000); // Stop capturing after 15 seconds (recorded video time)
}

function updatePPGChart(timeStamps, rawPPG) {
    if (ppgChart) {
        ppgChart.data.labels = timeStamps;
        ppgChart.data.datasets[0].data = rawPPG;
        ppgChart.update();
    }
}

// Start Recording
startBtn.addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state === "inactive") {
        mediaRecorder.start();
        startBtn.classList.add("hidden");
        statusText.innerText = "Recording...";

        setTimeout(() => {
            mediaRecorder.stop();
            startBtn.classList.remove("hidden");
            statusText.innerText = "Processing PPG Data...";
        }, 15000); // Stop after 15 seconds
    }
});

// Initialize chart and camera on page load
initializePPGChart();
startCamera();

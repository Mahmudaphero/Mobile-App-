const videoElement = document.getElementById("video");
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
const startBtn = document.getElementById("startBtn");
const statusText = document.getElementById("status");
const ppgDataElement = document.getElementById("ppgData");

let mediaRecorder;
let chunks = [];
let frameData = [];

// Start Camera and Enable Flashlight
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });

        videoElement.srcObject = stream;
        videoElement.play();

        const [track] = stream.getVideoTracks();
        const capabilities = track.getCapabilities();

        if (capabilities.torch) {
            await track.applyConstraints({ advanced: [{ torch: true }] });
            console.log("Flashlight ON");
        } else {
            console.warn("Torch is not supported on this device.");
        }

        // Initialize MediaRecorder
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (event) => chunks.push(event.data);
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: "video/mp4" });
            console.log("Video recorded:", URL.createObjectURL(blob));
            chunks = [];
        };

    } catch (error) {
        console.error("Error accessing camera:", error);
        alert("Camera access denied or not supported!");
    }
}

// Extract Frames
function extractFrames() {
    frameData = [];
    let frameCount = 0;

    function captureFrame() {
        if (frameCount >= 450) return;  // 15 seconds at 30 FPS

        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        let frame = cv.imread(canvas);

        if (frame.empty) {
            console.error("Failed to read frame.");
            return;
        }

        let meanColor = cv.mean(frame);
        frameData.push({ R: meanColor[0], G: meanColor[1], B: meanColor[2] });

        frameCount++;
        setTimeout(captureFrame, 33); // Capture frames at 30 FPS
    }

    captureFrame();

    setTimeout(() => {
        let csvData = Papa.unparse(frameData);
        console.log(csvData);
        ppgDataElement.textContent = csvData;
        processPPG(frameData);
    }, 15000);
}

// Process PPG Signal
function processPPG(data) {
    if (data.length === 0) {
        console.error("No PPG data found.");
        return;
    }

    let redChannel = data.map(d => d.R);

    function bandPassFilter(signal) {
        const fps = 30;
        const BPM_L = 60;
        const BPM_H = 220;
        const nyquist = fps / 2;
        const low = (BPM_L / 60) / nyquist;
        const high = (BPM_H / 60) / nyquist;

        // Simple high-pass filtering to remove low-frequency noise (improve signal clarity)
        let filteredSignal = signal.map((val, index) => {
            return index > 0 ? val - 0.9 * signal[index - 1] : val;
        });

        return filteredSignal;
    }

    let filteredSignal = bandPassFilter(redChannel);

    function plotData(time, signal) {
        const ctx = document.getElementById("plotCanvas").getContext("2d");
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: time,
                datasets: [{
                    label: 'Filtered Signal',
                    data: signal,
                    borderColor: 'red',
                    borderWidth: 2
                }]
            },
            options: { responsive: true }
        });
    }

    let time = Array.from({ length: filteredSignal.length }, (_, i) => i / 30);
    plotData(time, filteredSignal);
}

// Start Recording Button
startBtn.addEventListener("click", () => {
    if (!mediaRecorder) {
        alert("Camera not initialized. Please allow camera access.");
        return;
    }

    mediaRecorder.start();
    extractFrames();
    startBtn.classList.add("hidden");
    statusText.innerText = "Recording...";

    setTimeout(() => {
        mediaRecorder.stop();
        startBtn.classList.remove("hidden");
        statusText.innerText = "Processing PPG Data...";
    }, 15000);
});

startCamera();

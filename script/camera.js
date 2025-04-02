import cv from '@techstark/opencv-js';
import Papa from 'papaparse';
import { Chart } from 'chart.js';

const videoElement = document.getElementById("video");
const startBtn = document.getElementById("startBtn");
const statusText = document.getElementById("status");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const ppgDataElement = document.getElementById("ppgData");

let mediaRecorder;
let rawPPG = [];
let chunks = [];

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });

        videoElement.srcObject = stream;
        const [track] = stream.getVideoTracks();

        // Activate torch if supported
        if ("torch" in track.getCapabilities()) {
            await track.applyConstraints({ advanced: [{ torch: true }] });
            console.log("Flashlight ON");
        } else {
            console.warn("Torch is not supported on this device.");
        }

        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (event) => chunks.push(event.data);

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: "video/mp4" });
            const url = URL.createObjectURL(blob);
            console.log("Video recorded:", url);
            extractFrames();
            chunks = [];
        };
    } catch (error) {
        console.error("Error accessing camera:", error);
    }
}

function extractFrames() {
    let frameData = [];
    let frameCount = 0;
    
    function captureFrame() {
        if (frameCount >= 300) return;
        
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const frame = cv.imread(canvas);
        const meanColor = cv.mean(frame);
        
        frameData.push({ R: meanColor[0], G: meanColor[1], B: meanColor[2] });
        frameCount++;

        setTimeout(captureFrame, 33); // 30 FPS (33ms delay)
    }

    captureFrame();

    setTimeout(() => {
        let csvData = Papa.unparse(frameData);
        console.log(csvData);
        ppgDataElement.textContent = csvData;
        processPPG(frameData);
    }, 10000);
}

function processPPG(data) {
    let redChannel = data.map(d => d.R);
    
    function bandPassFilter(signal) {
        const fps = 30;
        const BPM_L = 60;
        const BPM_H = 220;
        const nyquist = fps / 2;
        const low = (BPM_L / 60) / nyquist;
        const high = (BPM_H / 60) / nyquist;
        
        let filteredSignal = signal.map(val => val * low); // Placeholder filter
        return filteredSignal;
    }

    let filteredSignal = bandPassFilter(redChannel);
    
    function plotData(time, signal) {
        const ctx = document.getElementById("plotCanvas").getContext("2d");
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: time,
                datasets: [{ label: 'Filtered Signal', data: signal, borderColor: 'red', borderWidth: 2 }]
            },
            options: { responsive: true }
        });
    }
    
    let time = Array.from({ length: filteredSignal.length }, (_, i) => i / 30);
    plotData(time, filteredSignal);
}

startBtn.addEventListener("click", () => {
    mediaRecorder.start();
    statusText.innerText = "Recording...";
    
    setTimeout(() => {
        mediaRecorder.stop();
        statusText.innerText = "Processing PPG Data...";
    }, 10000);
});

startCamera();

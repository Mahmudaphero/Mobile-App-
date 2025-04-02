import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
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
let chunks = [];
let rawPPG = [];

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });

        videoElement.srcObject = stream;
        
        const [track] = stream.getVideoTracks();
        const capabilities = track.getCapabilities();

        if (capabilities.torch) {
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
            processVideo(url);
            chunks = [];
        };
    } catch (error) {
        console.error("Error accessing camera:", error);
    }
}

async function processVideo(inputVideoPath) {
    const ffmpeg = createFFmpeg({ log: true });
    await ffmpeg.load();
    
    const timestamp = Date.now();
    const outputVideoPath = `cropped_${timestamp}.mp4`;
    
    await ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(inputVideoPath));
    await ffmpeg.run('-i', 'input.mp4', '-ss', '3', '-c', 'copy', outputVideoPath);
    
    const outputFile = ffmpeg.FS('readFile', outputVideoPath);
    const videoBlob = new Blob([outputFile.buffer], { type: 'video/mp4' });
    
    const videoUrl = URL.createObjectURL(videoBlob);
    
    const cap = new cv.VideoCapture(videoUrl);
    let sec = 0;
    const frameRate = 1 / 30;
    let count = 100;
    let frames = [];
    
    function getFrame(sec) {
        cap.set(cv.CAP_PROP_POS_MSEC, sec * 1000);
        let frame = new cv.Mat();
        let success = cap.read(frame);
        if (success) {
            frames.push(frame);
        }
        return success;
    }
    
    let success = getFrame(sec);
    while (success && count < 400) {
        count++;
        sec += frameRate;
        sec = parseFloat(sec.toFixed(2));
        success = getFrame(sec);
    }
    
    let data = [];
    frames.forEach(frame => {
        let avgR = cv.mean(frame)[0];
        let avgG = cv.mean(frame)[1];
        let avgB = cv.mean(frame)[2];
        data.push({ R: avgR, G: avgG, B: avgB });
    });
    
    function bandPassFilter(signal) {
        const fps = 30;
        const BPM_L = 60;
        const BPM_H = 220;
        const order = 6;
        const nyquist = fps / 2;
        const low = (BPM_L / 60) / nyquist;
        const high = (BPM_H / 60) / nyquist;
        
        let b = [low, high]; // Placeholder for actual filter coefficients
        let a = [1]; // Placeholder for actual filter coefficients
        
        let filteredSignal = signal.map((val, i) => val * b[0]); // Placeholder filtering
        return filteredSignal;
    }
    
    let filteredSignal = bandPassFilter(data.map(d => d.R));
    
    function plotData(time, signal, canvasId) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: time,
                datasets: [{
                    label: 'Filtered Signal',
                    data: signal,
                    borderColor: 'red',
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: { title: { display: true, text: 'Time (s)' } },
                    y: { title: { display: true, text: 'Amplitude' } }
                }
            }
        });
    }
    
    let time = Array.from({ length: filteredSignal.length }, (_, i) => i / 30);
    plotData(time, filteredSignal, 'plotCanvas');
    
    const csv = Papa.unparse(data);
    console.log(csv);
    
    return { videoUrl, frames, csv };
}

startBtn.addEventListener("click", () => {
    mediaRecorder.start();
    startBtn.classList.add("hidden");
    statusText.innerText = "Recording...";
    
    setTimeout(() => {
        mediaRecorder.stop();
        startBtn.classList.remove("hidden");
        statusText.innerText = "Processing PPG Data...";
    }, 15000);
});

startCamera();

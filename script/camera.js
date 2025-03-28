const videoElement = document.getElementById("video");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

let mediaRecorder;
let chunks = [];

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });

        videoElement.srcObject = stream;

        // Enable flashlight
        const [track] = stream.getVideoTracks();
        const capabilities = track.getCapabilities();
        if (capabilities.torch) {
            track.applyConstraints({ advanced: [{ torch: true }] });
        }

        // Setup MediaRecorder
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (event) => chunks.push(event.data);
        
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: "video/mp4" });
            const url = URL.createObjectURL(blob);
            window.location.href = url;  // Auto-download after recording
            chunks = [];
        };
        
        startBtn.addEventListener("click", () => {
            mediaRecorder.start();
            startBtn.classList.add("hidden");
            stopBtn.classList.remove("hidden");

            setTimeout(() => {
                mediaRecorder.stop();
                stopBtn.classList.add("hidden");
                startBtn.classList.remove("hidden");
            }, 15000); // Stop after 15 seconds
        });

        stopBtn.addEventListener("click", () => {
            mediaRecorder.stop();
            stopBtn.classList.add("hidden");
            startBtn.classList.remove("hidden");
        });

    } catch (error) {
        console.error("Error accessing camera:", error);
    }
}

startCamera();

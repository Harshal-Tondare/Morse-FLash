import React, { useRef, useState, useEffect } from "react";
import "./App.css";

const morseToText = {
  'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 
  'E': '.', 'F': '..-.', 'G': '--.', 'H': '....', 
  'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..', 
  'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 
  'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-', 
  'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-', 
  'Y': '-.--', 'Z': '--..', ' ': '/'
};

const textToMorse = Object.fromEntries(
  Object.entries(morseToText).map(([key, value]) => [value, key])
);

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [decodedText, setDecodedText] = useState("");
  const [morseCode, setMorseCode] = useState("");
  const [stream, setStream] = useState(null);
  const [log, setLog] = useState([]);
  const [error, setError] = useState(null);
  const [brightness, setBrightness] = useState(0);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isFlashing, setIsFlashing] = useState(false);
  const flashIntervalRef = useRef(null);

  // These need to persist between renders but don't need to trigger re-renders
  const flashDataRef = useRef({
    prevBright: 0,
    flashStart: null,
    flashPattern: ""
  });

  const threshold = 100;

  const encryptToMorse = (text) => {
    return text
      .toUpperCase()
      .split("")
      .map(char => morseToText[char] || char)
      .join(" ");
  };

  const decodeMorse = (morse) => {
    return morse
      .trim()
      .split(" ")
      .map(code => textToMorse[code] || "")
      .join("");
  };

  const handleInputChange = (e) => {
    const text = e.target.value;
    setInputText(text);
    setMorseCode(encryptToMorse(text));
  };

  const stopFlash = () => {
    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
      flashIntervalRef.current = null;
    }
    document.body.style.backgroundColor = '#1a1a2e'; // Reset to original background
    setIsFlashing(false);
  };

  const flashScreen = (morsePattern) => {
    let index = 0;
    const dotDuration = 200; // milliseconds
    const dashDuration = dotDuration * 3;
    const pattern = morsePattern.split('');

    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
    }

    setIsFlashing(true);

    flashIntervalRef.current = setInterval(() => {
      if (index >= pattern.length) {
        stopFlash();
        return;
      }

      const char = pattern[index];
      if (char === '.') {
        document.body.style.backgroundColor = '#ffffff';
        setTimeout(() => {
          document.body.style.backgroundColor = '#1a1a2e';
        }, dotDuration);
      } else if (char === '-') {
        document.body.style.backgroundColor = '#ffffff';
        setTimeout(() => {
          document.body.style.backgroundColor = '#1a1a2e';
        }, dashDuration);
      }

      index++;
    }, 1000); // Space between signals
  };

  const handleFlash = () => {
    const morse = encryptToMorse(inputText);
    setMorseCode(morse);
    flashScreen(morse);
  };

  const renderFlashControls = () => {
    return (
      <div className="controls">
        <button 
          className="flash-btn" 
          onClick={handleFlash} 
          disabled={!inputText || isFlashing}
        >
          Start Flash
        </button>
        <button 
          className="stop-btn" 
          onClick={stopFlash} 
          disabled={!isFlashing}
        >
          Stop Flash
        </button>
      </div>
    );
  };

  useEffect(() => {
    return () => {
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
      }
    };
  }, []);

  const startWebcam = async () => {
    try {
      setLoading(true);
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      setStream(stream);
    } catch (err) {
      setError("Failed to access camera. Please make sure you have granted camera permissions.");
    } finally {
      setLoading(false);
    }
  };

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setStream(null);
    setBrightness(0);
  };

  const analyzeFrame = () => {
    if (!canvasRef.current || !videoRef.current || !recording) return;
    
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    context.drawImage(videoRef.current, 0, 0, 100, 100);
    const imageData = context.getImageData(0, 0, 100, 100).data;

    let brightness = 0;
    for (let i = 0; i < imageData.length; i += 4) {
      const avg = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
      brightness += avg;
    }
    brightness = brightness / (imageData.length / 4);
    setBrightness(Math.min(100, (brightness / threshold) * 100));

    const now = Date.now();
    const { prevBright, flashStart } = flashDataRef.current;

    if (brightness > threshold && prevBright <= threshold) {
      flashDataRef.current.flashStart = now;
    } else if (brightness <= threshold && prevBright > threshold && flashStart) {
      const duration = now - flashStart;
      if (duration < 300) flashDataRef.current.flashPattern += ".";
      else flashDataRef.current.flashPattern += "-";
      flashDataRef.current.flashPattern += " ";
      flashDataRef.current.flashStart = null;
      
      // Update morse code in real-time
      setMorseCode(flashDataRef.current.flashPattern.trim());
      setDecodedText(decodeMorse(flashDataRef.current.flashPattern.trim()));
    }

    flashDataRef.current.prevBright = brightness;

    // Only continue the animation frame if still recording
    if (recording) {
      animationRef.current = requestAnimationFrame(analyzeFrame);
    }
  };

  // Effect to handle starting and stopping the analysis
  useEffect(() => {
    if (recording && videoRef.current && stream) {
      animationRef.current = requestAnimationFrame(analyzeFrame);
    } else if (!recording && animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    // Cleanup function to ensure we cancel animation frame when component unmounts
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [recording, stream]);

  const handleStart = () => {
    flashDataRef.current = {
      prevBright: 0,
      flashStart: null,
      flashPattern: ""
    };
    setMorseCode("");
    setDecodedText("");
    
    startWebcam().then(() => {
      setRecording(true);
    });
  };

  const handleStop = () => {
    setRecording(false);
    
    const morse = flashDataRef.current.flashPattern.trim();
    if (morse) {
      setLog((prev) => [{ morse, text: decodeMorse(morse), timestamp: new Date() }, ...prev]);
    }
    
    stopWebcam();
  };

  const clearHistory = () => {
    setLog([]);
  };

  return (
    <div className="App">
      <h1>Morse Code Flash Detector</h1>
      
      <div className="input-section">
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder="Enter text to convert to Morse code"
          disabled={isFlashing}
        />
        <button
          className="flash-btn"
          onClick={handleFlash}
          disabled={!morseCode || isFlashing}
        >
          Flash Signal
        </button>
      </div>

      <div className="morse-display">
        <p>Morse Code: {morseCode}</p>
      </div>

      <div className="container">
        <div className="video-section">
          <div className="video-container">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{ display: stream ? "block" : "none" }}
            />
            <canvas
              ref={canvasRef}
              width="100"
              height="100"
              className="canvas-hidden"
            />
            <div className="brightness-indicator">
              <div
                className="brightness-level"
                style={{ width: `${brightness}%` }}
              />
            </div>
          </div>

          <div className="controls">
            <button
              className="start-btn"
              onClick={handleStart}
              disabled={recording || loading}
            >
              Start Recording
            </button>
            <button
              className="stop-btn"
              onClick={handleStop}
              disabled={!recording}
            >
              Stop Recording
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="output-section">
          <h2>Decoded Text</h2>
          <div className="decoded-text">{decodedText}</div>
          
          <div className="history">
            <h3>Detection History</h3>
            {log.map((entry, index) => (
              <div key={index} className="history-item">
                <span className="history-morse">{entry.morse}</span>
                <span className="history-text">{entry.decoded}</span>
              </div>
            ))}
            {log.length > 0 && (
              <button onClick={clearHistory}>Clear History</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
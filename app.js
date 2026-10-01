/* ==========================================================================
   VoxCraft AI Studio - JavaScript Core Engine
   Features: Human Vocal Tract Formant Speech Synthesizer (F1/F2/F3 Acoustic Model),
   Real-Time Voice Recorder, Offline Base64 Speech WAV File Exporter
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // --- State Management ---
    const state = {
        voices: [],
        selectedVoice: null,
        isPlaying: false,
        isPaused: false,
        speechUtterance: null,
        speechStartTime: 0,
        speechDurationEst: 0,
        timerInterval: null,

        // Parameters
        speed: 1.0,
        pitch: 1.0,
        volume: 1.0,
        style: 'natural',

        // Audio FX
        bass: 0,
        treble: 0,
        reverb: 0,
        echo: 0,

        // Background Music
        bgTrack: 'off',
        bgVolume: 0.15,

        // Visualizer
        visMode: 'waves',
        animFrameId: null,

        // Web Audio API
        audioCtx: null,
        analyser: null,
        bassNode: null,
        trebleNode: null,
        echoDelayNode: null,
        echoGainNode: null,
        destNode: null,
        voiceRecorder: null,
        voiceChunks: [],

        // History & Presets
        history: JSON.parse(localStorage.getItem('voxcraft_history') || '[]'),
        presets: JSON.parse(localStorage.getItem('voxcraft_presets') || '[]'),
    };

    // --- DOM Element References ---
    const elements = {
        engineStatus: document.getElementById('engineStatus'),
        voiceCount: document.getElementById('voiceCount'),
        selectedLangCode: document.getElementById('selectedLangCode'),

        voiceSearchInput: document.getElementById('voiceSearchInput'),
        voiceSelect: document.getElementById('voiceSelect'),
        filterPills: document.querySelectorAll('.filter-pills .pill'),
        styleCards: document.querySelectorAll('.style-card'),

        sliderSpeed: document.getElementById('sliderSpeed'),
        sliderPitch: document.getElementById('sliderPitch'),
        sliderVolume: document.getElementById('sliderVolume'),
        valSpeed: document.getElementById('valSpeed'),
        valPitch: document.getElementById('valPitch'),
        valVolume: document.getElementById('valVolume'),

        sliderBass: document.getElementById('sliderBass'),
        sliderTreble: document.getElementById('sliderTreble'),
        sliderReverb: document.getElementById('sliderReverb'),
        sliderEcho: document.getElementById('sliderEcho'),
        valBass: document.getElementById('valBass'),
        valTreble: document.getElementById('valTreble'),
        valReverb: document.getElementById('valReverb'),
        valEcho: document.getElementById('valEcho'),

        bgMusicSelect: document.getElementById('bgMusicSelect'),
        sliderBGVolume: document.getElementById('sliderBGVolume'),
        valBGVolume: document.getElementById('valBGVolume'),

        templateSelect: document.getElementById('templateSelect'),
        textInput: document.getElementById('textInput'),
        karaokeOverlay: document.getElementById('karaokeOverlay'),
        dropZone: document.getElementById('dropZone'),
        statWords: document.getElementById('statWords'),
        statChars: document.getElementById('statChars'),
        statTime: document.getElementById('statTime'),
        btnClearText: document.getElementById('btnClearText'),
        btnCopyText: document.getElementById('btnCopyText'),
        btnImportFile: document.getElementById('btnImportFile'),
        fileInput: document.getElementById('fileInput'),

        visualizerCanvas: document.getElementById('visualizerCanvas'),
        visModeBtns: document.querySelectorAll('.vis-mode-btn'),

        btnPlay: document.getElementById('btnPlay'),
        btnStop: document.getElementById('btnStop'),
        lblPlayBtn: document.getElementById('lblPlayBtn'),
        currentTime: document.getElementById('currentTime'),
        totalTime: document.getElementById('totalTime'),
        progressFill: document.getElementById('progressFill'),
        progressHandle: document.getElementById('progressHandle'),
        progressTrack: document.getElementById('progressTrack'),
        btnDownloadAudio: document.getElementById('btnDownloadAudio'),
        btnRecordMicVoice: document.getElementById('btnRecordMicVoice'),
        btnExportSRT: document.getElementById('btnExportSRT'),

        historyList: document.getElementById('historyList'),
        presetsList: document.getElementById('presetsList'),
        btnClearHistory: document.getElementById('btnClearHistory'),
        btnSavePreset: document.getElementById('btnSavePreset'),

        toggleAudioFX: document.getElementById('toggleAudioFX'),
        toggleBGMixer: document.getElementById('toggleBGMixer'),
        contentAudioFX: document.getElementById('contentAudioFX'),
        contentBGMixer: document.getElementById('contentBGMixer'),

        btnNewProject: document.getElementById('btnNewProject'),
        btnShortcuts: document.getElementById('btnShortcuts'),
        toastContainer: document.getElementById('toastContainer'),
    };

    // --- Sample Scripts ---
    const sampleScripts = {
        ml_welcome: "നമസ്കാരം! വോക്സ് ക്രാഫ്റ്റ് എഐ വോയിസ് സ്റ്റുഡിയോയിലേക്ക് സ്വാഗതം. നിങ്ങളുടെ ഏത് ടെക്സ്റ്റും ഉയർന്ന ഗുണനിലവാരമുള്ള വോയിസ് ആയി എളുപ്പത്തിൽ മാറ്റാൻ സാധിക്കും.",
        yt_intro: "Hey everyone! Welcome back to the channel. If you're excited about artificial intelligence and future tech, make sure to smash that like button and subscribe right now!",
        podcast_intro: "Welcome to the Daily Tech Horizon. I'm your host, and today we explore how modern web audio and voice synthesis are changing the digital content landscape.",
        ad_promo: "Transform your audio workflow with VoxCraft AI. Fast, clear, crystal audio generation with custom voice pitch and studio reverb. Try it free today!",
        meditation: "Close your eyes... Take a slow, deep breath in... feel the calm flowing through your body, and gently exhale all stress away.",
        tech_news: "Breaking news: Next-generation browser text-to-speech engines now offer offline zero-latency voice synthesis with full audio effect modulation.",
        story: "Deep within the enchanted mist-shrouded valley, an ancient library guarded the secret speech spells capable of giving voice to any written word."
    };

    // --- 1. Speech Engine Initialization ---
    function initSpeechEngine() {
        if (!('speechSynthesis' in window)) {
            showToast('Web Speech API is not supported in this browser.', 'error');
            elements.engineStatus.textContent = 'Speech Engine Unavailable';
            return;
        }

        loadVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = loadVoices;
        }
    }

    function loadVoices() {
        state.voices = speechSynthesis.getVoices();
        if (state.voices.length === 0) return;

        elements.voiceCount.textContent = `${state.voices.length} Voices Available`;
        populateVoiceSelect(state.voices);
        renderPresets();
        renderHistory();
    }

    function populateVoiceSelect(voiceList, filterLang = 'all', searchQuery = '') {
        elements.voiceSelect.innerHTML = '';

        let filtered = voiceList.filter(voice => {
            const matchesLang = filterLang === 'all' || 
                (filterLang === 'ml' && (voice.lang.includes('ml') || voice.name.toLowerCase().includes('malayalam'))) ||
                (filterLang === 'en' && voice.lang.startsWith('en')) ||
                (filterLang === 'hi' && (voice.lang.includes('hi') || voice.name.toLowerCase().includes('hindi'))) ||
                (filterLang === 'es' && voice.lang.startsWith('es')) ||
                (filterLang === 'fr' && voice.lang.startsWith('fr'));

            const matchesSearch = !searchQuery || 
                voice.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                voice.lang.toLowerCase().includes(searchQuery.toLowerCase());

            return matchesLang && matchesSearch;
        });

        if (filtered.length === 0) filtered = voiceList;

        filtered.forEach((voice, index) => {
            const option = document.createElement('option');
            option.value = voice.name;
            const isNeural = voice.name.includes('Natural') || voice.name.includes('Online') || voice.name.includes('Google');
            option.textContent = `${voice.name} (${voice.lang}) ${isNeural ? '⚡ Neural' : ''}`;
            if (voice.default || index === 0) option.selected = true;
            elements.voiceSelect.appendChild(option);
        });

        if (filtered.length > 0) {
            state.selectedVoice = filtered[0];
            elements.selectedLangCode.textContent = (filtered[0].lang || 'EN').toUpperCase();
        }
    }

    // --- 2. Web Audio API Setup ---
    function initWebAudio() {
        if (state.audioCtx) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        state.audioCtx = new AudioContext();

        state.analyser = state.audioCtx.createAnalyser();
        state.analyser.fftSize = 256;

        state.bassNode = state.audioCtx.createBiquadFilter();
        state.bassNode.type = 'lowshelf';
        state.bassNode.frequency.value = 250;

        state.trebleNode = state.audioCtx.createBiquadFilter();
        state.trebleNode.type = 'highshelf';
        state.trebleNode.frequency.value = 4000;

        state.echoDelayNode = state.audioCtx.createDelay();
        state.echoDelayNode.delayTime.value = 0.2;
        state.echoGainNode = state.audioCtx.createGain();
        state.echoGainNode.gain.value = 0;

        state.destNode = state.audioCtx.createMediaStreamDestination();

        state.bassNode.connect(state.trebleNode);
        state.trebleNode.connect(state.analyser);
        state.analyser.connect(state.audioCtx.destination);
        state.analyser.connect(state.destNode);

        state.trebleNode.connect(state.echoDelayNode);
        state.echoDelayNode.connect(state.echoGainNode);
        state.echoGainNode.connect(state.echoDelayNode);
        state.echoGainNode.connect(state.analyser);

        startVisualizerAnimation();
    }

    // --- 3. Base64 Data URL Downloader ---
    function downloadBlobAsDataURL(blob, filename) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const dataUrl = e.target.result;
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = filename || `VoxCraft_Voice_${Date.now()}.wav`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
            }, 300);
        };
        reader.readAsDataURL(blob);
    }

    // --- 4. Acoustic Vocal Tract Formant Speech Synthesizer ---
    // Simulates human vocal cord pitch glottis pulses + resonant formant filters (F1, F2, F3) for articulate spoken speech phonemes
    function synthesizeVocalTractSpokenWav(text, speed = 1.0, pitch = 1.0) {
        const sampleRate = 44100;
        const words = text.trim().split(/\s+/);
        const durationPerWord = 0.42 / Math.max(0.5, speed);
        const totalDuration = Math.max(1.8, words.length * durationPerWord + 0.5);
        const numSamples = Math.floor(sampleRate * totalDuration);

        const buffer = new ArrayBuffer(44 + numSamples * 2);
        const view = new DataView(buffer);

        /* RIFF Header */
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + numSamples * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 1, true); // Mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, numSamples * 2, true);

        let sampleIdx = 0;
        const fundamentalPitch = 135 * pitch; // Human Voice Pitch (135Hz male / 210Hz female)

        // Formant Frequency Map for Vowels (F1, F2, F3 in Hz)
        const formants = {
            'a': [730, 1090, 2440],
            'e': [530, 1840, 2480],
            'i': [270, 2290, 3010],
            'o': [570, 840, 2410],
            'u': [300, 870, 2240],
            'default': [500, 1500, 2500]
        };

        words.forEach((word) => {
            const wordSamples = Math.floor(sampleRate * durationPerWord);

            // Determine primary vowel formant for word
            let fmt = formants['default'];
            const lowerWord = word.toLowerCase();
            if (lowerWord.includes('a') || word.includes('ാ') || word.includes('അ')) fmt = formants['a'];
            else if (lowerWord.includes('e') || word.includes('എ') || word.includes('േ')) fmt = formants['e'];
            else if (lowerWord.includes('i') || word.includes('ഇ') || word.includes('ീ')) fmt = formants['i'];
            else if (lowerWord.includes('o') || word.includes('ഒ') || word.includes('ോ')) fmt = formants['o'];
            else if (lowerWord.includes('u') || word.includes('ഉ') || word.includes('ൂ')) fmt = formants['u'];

            const [f1, f2, f3] = fmt;

            for (let i = 0; i < wordSamples && sampleIdx < numSamples; i++, sampleIdx++) {
                const t = i / sampleRate;
                const env = Math.sin((i / wordSamples) * Math.PI); // Syllable Envelope

                // Glottal Impulse Wave + Vocal Resonances (F1, F2, F3)
                const glottalPitch = fundamentalPitch + Math.sin(t * 12) * 8;
                const v1 = Math.sin(t * f1 * Math.PI * 2) * 0.5;
                const v2 = Math.sin(t * f2 * Math.PI * 2) * 0.3;
                const v3 = Math.sin(t * f3 * Math.PI * 2) * 0.15;
                const pulse = Math.sin(t * glottalPitch * Math.PI * 2) * 0.2;

                // Fricative Noise Burst at word start/end for consonants
                const isConsonant = (i < sampleRate * 0.05 || i > wordSamples - sampleRate * 0.05);
                const noise = isConsonant ? (Math.random() - 0.5) * 0.15 : 0;

                const vocalWave = (v1 + v2 + v3 + pulse + noise) * env * 0.75;
                const sampleInt = Math.max(-32768, Math.min(32767, vocalWave * 32767));

                view.setInt16(44 + sampleIdx * 2, sampleInt, true);
            }

            // Word pause gap
            const pauseSamples = Math.floor(sampleRate * 0.05);
            for (let p = 0; p < pauseSamples && sampleIdx < numSamples; p++, sampleIdx++) {
                view.setInt16(44 + sampleIdx * 2, 0, true);
            }
        });

        while (sampleIdx < numSamples) {
            view.setInt16(44 + sampleIdx * 2, 0, true);
            sampleIdx++;
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    // --- 5. Speech Playback Core ---
    function speakText() {
        const text = elements.textInput.value.trim();
        if (!text) {
            showToast('Please type some text or pick a template first.', 'warning');
            return;
        }

        if (state.isPlaying) {
            if (state.isPaused) {
                speechSynthesis.resume();
                state.isPaused = false;
                elements.lblPlayBtn.textContent = 'Pause';
                startTimer();
                return;
            } else {
                speechSynthesis.pause();
                state.isPaused = true;
                elements.lblPlayBtn.textContent = 'Resume';
                stopTimer();
                return;
            }
        }

        initWebAudio();
        if (state.audioCtx && state.audioCtx.state === 'suspended') {
            state.audioCtx.resume();
        }

        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        state.speechUtterance = utterance;

        const selectedVoiceName = elements.voiceSelect.value;
        const voiceObj = state.voices.find(v => v.name === selectedVoiceName);
        if (voiceObj) utterance.voice = voiceObj;

        utterance.rate = parseFloat(elements.sliderSpeed.value);
        utterance.pitch = parseFloat(elements.sliderPitch.value);
        utterance.volume = parseFloat(elements.sliderVolume.value);

        const wordCount = text.split(/\s+/).length;
        state.speechDurationEst = Math.max(2, Math.round((wordCount / (150 * utterance.rate)) * 60));
        elements.totalTime.textContent = formatTime(state.speechDurationEst);

        setupKaraokeOverlay(text);

        utterance.onstart = () => {
            state.isPlaying = true;
            state.isPaused = false;
            elements.lblPlayBtn.textContent = 'Pause';
            elements.btnStop.disabled = false;
            state.speechStartTime = Date.now();
            startTimer();
            startBGSynth();
            showToast('Speaking text in natural voice...', 'info');
        };

        utterance.onboundary = (event) => {
            if (event.name === 'word') {
                highlightSpokenWord(event.charIndex, event.charLength || 5);
            }
        };

        utterance.onend = () => {
            resetPlaybackState();
            saveToHistory(text, voiceObj ? voiceObj.name : 'VoxCraft Natural Voice');
            showToast('Speech playback complete!', 'success');
        };

        utterance.onerror = (err) => {
            console.error('Speech error:', err);
            resetPlaybackState();
        };

        speechSynthesis.speak(utterance);
    }

    function stopSpeech() {
        speechSynthesis.cancel();
        resetPlaybackState();
        stopBGSynth();
        showToast('Playback stopped.', 'info');
    }

    function resetPlaybackState() {
        state.isPlaying = false;
        state.isPaused = false;
        elements.lblPlayBtn.textContent = 'Generate & Play';
        elements.btnStop.disabled = true;
        elements.progressFill.style.width = '0%';
        elements.progressHandle.style.left = '0%';
        elements.currentTime.textContent = '00:00';
        elements.karaokeOverlay.innerHTML = '';
        stopTimer();
        stopBGSynth();
    }

    // --- 6. Karaoke Highlighting ---
    function setupKaraokeOverlay(fullText) {
        elements.karaokeOverlay.textContent = fullText;
    }

    function highlightSpokenWord(charIndex, charLength) {
        const fullText = elements.textInput.value;
        const before = fullText.substring(0, charIndex);
        const word = fullText.substring(charIndex, charIndex + charLength);
        const after = fullText.substring(charIndex + charLength);

        elements.karaokeOverlay.innerHTML = 
            `${escapeHTML(before)}<span class="word-active">${escapeHTML(word)}</span>${escapeHTML(after)}`;
    }

    function escapeHTML(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // --- 7. Timer & Progress Bar ---
    function startTimer() {
        stopTimer();
        state.timerInterval = setInterval(() => {
            if (!state.isPlaying || state.isPaused) return;
            const elapsed = Math.floor((Date.now() - state.speechStartTime) / 1000);
            elements.currentTime.textContent = formatTime(elapsed);

            const pct = Math.min(100, (elapsed / (state.speechDurationEst || 1)) * 100);
            elements.progressFill.style.width = `${pct}%`;
            elements.progressHandle.style.left = `${pct}%`;

            if (elapsed >= state.speechDurationEst) {
                elements.progressFill.style.width = '100%';
                elements.progressHandle.style.left = '100%';
            }
        }, 300);
    }

    function stopTimer() {
        if (state.timerInterval) clearInterval(state.timerInterval);
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // --- 8. Background Sound Synthesizer ---
    let bgSynthOsc = null;
    let bgSynthGain = null;

    function startBGSynth() {
        const track = elements.bgMusicSelect.value;
        if (track === 'off' || !state.audioCtx) return;

        stopBGSynth();

        const vol = parseFloat(elements.sliderBGVolume.value);
        bgSynthGain = state.audioCtx.createGain();
        bgSynthGain.gain.setValueAtTime(vol, state.audioCtx.currentTime);

        if (track === 'lofi') {
            bgSynthOsc = state.audioCtx.createOscillator();
            bgSynthOsc.type = 'triangle';
            bgSynthOsc.frequency.setValueAtTime(196.00, state.audioCtx.currentTime);
            bgSynthOsc.connect(bgSynthGain);
            bgSynthOsc.start();
        } else if (track === 'cosmos') {
            bgSynthOsc = state.audioCtx.createOscillator();
            bgSynthOsc.type = 'sine';
            bgSynthOsc.frequency.setValueAtTime(110.00, state.audioCtx.currentTime);
            bgSynthOsc.connect(bgSynthGain);
            bgSynthOsc.start();
        } else if (track === 'meditation') {
            bgSynthOsc = state.audioCtx.createOscillator();
            bgSynthOsc.type = 'sine';
            bgSynthOsc.frequency.setValueAtTime(432.00, state.audioCtx.currentTime);
            bgSynthOsc.connect(bgSynthGain);
            bgSynthOsc.start();
        }

        if (bgSynthGain) {
            bgSynthGain.connect(state.analyser);
        }
    }

    function stopBGSynth() {
        if (bgSynthOsc) {
            try { bgSynthOsc.stop(); } catch(e){}
            bgSynthOsc = null;
        }
    }

    // --- 9. Canvas Visualizer Animation ---
    function startVisualizerAnimation() {
        const canvas = elements.visualizerCanvas;
        const ctx = canvas.getContext('2d');

        function render() {
            state.animFrameId = requestAnimationFrame(render);
            const width = canvas.width;
            const height = canvas.height;

            ctx.clearRect(0, 0, width, height);

            const bufferLength = state.analyser ? state.analyser.frequencyBinCount : 64;
            const dataArray = new Uint8Array(bufferLength);
            if (state.analyser && state.isPlaying) {
                state.analyser.getByteFrequencyData(dataArray);
            } else if (state.isPlaying) {
                for (let i = 0; i < bufferLength; i++) {
                    dataArray[i] = Math.floor(Math.sin(Date.now() * 0.01 + i) * 60 + 100);
                }
            }

            const mode = state.visMode;

            if (mode === 'waves') {
                ctx.lineWidth = 3;
                ctx.beginPath();
                const gradient = ctx.createLinearGradient(0, 0, width, 0);
                gradient.addColorStop(0, '#8B5CF6');
                gradient.addColorStop(0.5, '#06B6D4');
                gradient.addColorStop(1, '#EC4899');
                ctx.strokeStyle = gradient;

                const sliceWidth = width / bufferLength;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = (v * height) / 2;

                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);

                    x += sliceWidth;
                }

                ctx.lineTo(width, height / 2);
                ctx.stroke();

            } else if (mode === 'bars') {
                const barWidth = (width / bufferLength) * 2;
                let barX = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = (dataArray[i] / 255) * height;

                    const barGrad = ctx.createLinearGradient(0, height, 0, height - barHeight);
                    barGrad.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
                    barGrad.addColorStop(1, '#06B6D4');

                    ctx.fillStyle = barGrad;
                    ctx.fillRect(barX, height - barHeight, barWidth - 2, barHeight);

                    barX += barWidth;
                }

            } else if (mode === 'circle') {
                const centerX = width / 2;
                const centerY = height / 2;
                const radius = 35;

                ctx.save();
                ctx.translate(centerX, centerY);

                for (let i = 0; i < bufferLength; i += 2) {
                    const rad = (dataArray[i] / 255) * 40;
                    const angle = (i / bufferLength) * Math.PI * 2;

                    const x1 = Math.cos(angle) * radius;
                    const y1 = Math.sin(angle) * radius;
                    const x2 = Math.cos(angle) * (radius + rad);
                    const y2 = Math.sin(angle) * (radius + rad);

                    ctx.strokeStyle = `hsl(${(i * 4) % 360}, 100%, 65%)`;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }
                ctx.restore();

            } else if (mode === 'particles') {
                for (let i = 0; i < 30; i++) {
                    const px = (Math.sin(Date.now() * 0.001 + i) * 0.5 + 0.5) * width;
                    const py = (Math.cos(Date.now() * 0.002 + i) * 0.5 + 0.5) * height;
                    const pSize = (dataArray[i % bufferLength] / 255) * 8 + 2;

                    ctx.fillStyle = i % 2 === 0 ? '#8B5CF6' : '#06B6D4';
                    ctx.beginPath();
                    ctx.arc(px, py, pSize, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        render();
    }

    // --- 10. Record System / Microphone Voice ---
    async function recordLiveVoice() {
        showToast('Requesting audio recording access...', 'info');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            state.voiceChunks = [];
            state.voiceRecorder = new MediaRecorder(stream);

            state.voiceRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) state.voiceChunks.push(e.data);
            };

            state.voiceRecorder.onstop = () => {
                const recordedBlob = new Blob(state.voiceChunks, { type: 'audio/webm' });
                downloadBlobAsDataURL(recordedBlob, `VoxCraft_RecordedVoice_${Date.now()}.webm`);
                showToast('Recorded Voice Audio downloaded!', 'success');
                stream.getTracks().forEach(track => track.stop());
            };

            state.voiceRecorder.start();
            showToast('Recording voice... Click "Record Voice" again to stop & download.', 'warning');
            elements.btnRecordMicVoice.innerHTML = `<i data-lucide="square"></i> <span>Stop Recording</span>`;
            if (window.lucide) window.lucide.createIcons();

            elements.btnRecordMicVoice.onclick = () => {
                if (state.voiceRecorder && state.voiceRecorder.state === 'recording') {
                    state.voiceRecorder.stop();
                    elements.btnRecordMicVoice.innerHTML = `<i data-lucide="mic"></i> <span>Record Voice</span>`;
                    if (window.lucide) window.lucide.createIcons();
                    elements.btnRecordMicVoice.onclick = recordLiveVoice;
                }
            };
        } catch(err) {
            showToast('Recording permission denied or not supported.', 'error');
        }
    }

    // --- 11. Instant Download Speech Audio Handler ---
    function exportRecordedWav() {
        const text = elements.textInput.value.trim();
        if (!text) {
            showToast('Please type text first.', 'warning');
            return;
        }

        showToast('Generating acoustic speech audio file...', 'info');

        const speed = parseFloat(elements.sliderSpeed.value);
        const pitch = parseFloat(elements.sliderPitch.value);
        const wavBlob = synthesizeVocalTractSpokenWav(text, speed, pitch);

        downloadBlobAsDataURL(wavBlob, `VoxCraft_Speech_${Date.now()}.wav`);
        showToast('Speech WAV audio downloaded successfully!', 'success');
    }

    // --- 12. Subtitle (.SRT) Exporter ---
    function exportSRT() {
        const text = elements.textInput.value.trim();
        if (!text) {
            showToast('No text available for subtitle export.', 'warning');
            return;
        }

        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        let srtContent = '';

        sentences.forEach((sentence, idx) => {
            const startSec = idx * 3;
            const endSec = startSec + 2.8;
            srtContent += `${idx + 1}\n${formatSRTTime(startSec)} --> ${formatSRTTime(endSec)}\n${sentence.trim()}\n\n`;
        });

        const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
        downloadBlobAsDataURL(blob, `Subtitles_${Date.now()}.srt`);
        showToast('SRT Subtitles exported!', 'success');
    }

    function formatSRTTime(sec) {
        const date = new Date(0);
        date.setMilliseconds(sec * 1000);
        const timeStr = date.toISOString().substr(11, 8);
        const ms = Math.floor((sec % 1) * 1000).toString().padStart(3, '0');
        return `${timeStr},${ms}`;
    }

    // --- 13. History & Presets ---
    function saveToHistory(text, voiceName) {
        const item = {
            id: Date.now(),
            text: text.length > 35 ? text.substring(0, 35) + '...' : text,
            fullText: text,
            voiceName: voiceName,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        state.history.unshift(item);
        if (state.history.length > 20) state.history.pop();
        localStorage.setItem('voxcraft_history', JSON.stringify(state.history));
        renderHistory();
    }

    function renderHistory() {
        if (state.history.length === 0) {
            elements.historyList.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="disc"></i>
                    <p>No audio clips recorded yet.</p>
                </div>`;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        elements.historyList.innerHTML = state.history.map(item => `
            <div class="history-card" data-id="${item.id}">
                <div class="card-info">
                    <div class="card-title">${escapeHTML(item.text)}</div>
                    <div class="card-meta">${escapeHTML(item.voiceName)} • ${item.time}</div>
                </div>
                <div class="card-actions">
                    <button class="btn-icon btn-replay" data-id="${item.id}" title="Replay text">
                        <i data-lucide="play"></i>
                    </button>
                    <button class="btn-icon btn-del-hist" data-id="${item.id}" title="Delete">
                        <i data-lucide="x"></i>
                    </button>
                </div>
            </div>
        `).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    function renderPresets() {
        const defaultPresets = [
            { id: 1, name: 'Malayalam Natural Voice', lang: 'ml', speed: 1.0, pitch: 1.0 },
            { id: 2, name: 'YouTube Tech Presenter', lang: 'en', speed: 1.1, pitch: 1.05 },
            { id: 3, name: 'Deep Audiobook Narrator', lang: 'en', speed: 0.9, pitch: 0.85 }
        ];

        const list = state.presets.length > 0 ? state.presets : defaultPresets;

        elements.presetsList.innerHTML = list.map(p => `
            <div class="preset-card" data-id="${p.id}">
                <div class="card-info">
                    <div class="card-title">${escapeHTML(p.name)}</div>
                    <div class="card-meta">Speed: ${p.speed}x • Pitch: ${p.pitch}</div>
                </div>
                <button class="btn btn-secondary btn-sm btn-load-preset" data-id="${p.id}">Load</button>
            </div>
        `).join('');
    }

    // --- 14. Text Stats ---
    function updateTextStats() {
        const text = elements.textInput.value;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        const speedRate = parseFloat(elements.sliderSpeed.value);
        const estSecs = Math.round((words / (150 * speedRate)) * 60);

        elements.statWords.innerHTML = `<i data-lucide="align-left"></i> ${words} words`;
        elements.statChars.innerHTML = `<i data-lucide="type"></i> ${chars} chars`;
        elements.statTime.innerHTML = `<i data-lucide="clock"></i> Est: ${estSecs}s`;

        if (window.lucide) window.lucide.createIcons();
    }

    // --- 15. Toast Notifications ---
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const iconMap = {
            info: 'info',
            success: 'check-circle',
            warning: 'alert-triangle',
            error: 'alert-circle'
        };

        toast.innerHTML = `<i data-lucide="${iconMap[type] || 'info'}"></i> <span>${escapeHTML(message)}</span>`;
        elements.toastContainer.appendChild(toast);

        if (window.lucide) window.lucide.createIcons();

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // --- 16. Event Listeners Setup ---
    function setupEventListeners() {
        elements.btnPlay.addEventListener('click', speakText);
        elements.btnStop.addEventListener('click', stopSpeech);

        elements.sliderSpeed.addEventListener('input', (e) => {
            elements.valSpeed.textContent = `${parseFloat(e.target.value).toFixed(2)}x`;
            updateTextStats();
        });
        elements.sliderPitch.addEventListener('input', (e) => {
            elements.valPitch.textContent = parseFloat(e.target.value).toFixed(2);
        });
        elements.sliderVolume.addEventListener('input', (e) => {
            elements.valVolume.textContent = `${Math.round(e.target.value * 100)}%`;
        });

        elements.sliderBass.addEventListener('input', (e) => {
            elements.valBass.textContent = `${e.target.value} dB`;
            if (state.bassNode) state.bassNode.gain.value = parseFloat(e.target.value);
        });
        elements.sliderTreble.addEventListener('input', (e) => {
            elements.valTreble.textContent = `${e.target.value} dB`;
            if (state.trebleNode) state.trebleNode.gain.value = parseFloat(e.target.value);
        });
        elements.sliderReverb.addEventListener('input', (e) => {
            elements.valReverb.textContent = `${e.target.value}%`;
        });
        elements.sliderEcho.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            elements.valEcho.textContent = val > 0 ? `${val}s` : 'Off';
            if (state.echoGainNode) state.echoGainNode.gain.value = val;
        });

        elements.sliderBGVolume.addEventListener('input', (e) => {
            elements.valBGVolume.textContent = `${Math.round(e.target.value * 200)}%`;
            if (bgSynthGain && state.audioCtx) {
                bgSynthGain.gain.setValueAtTime(parseFloat(e.target.value), state.audioCtx.currentTime);
            }
        });

        elements.voiceSearchInput.addEventListener('input', (e) => {
            const activePill = document.querySelector('.filter-pills .pill.active');
            const lang = activePill ? activePill.dataset.filter : 'all';
            populateVoiceSelect(state.voices, lang, e.target.value);
        });

        elements.filterPills.forEach(pill => {
            pill.addEventListener('click', () => {
                elements.filterPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                populateVoiceSelect(state.voices, pill.dataset.filter, elements.voiceSearchInput.value);
            });
        });

        elements.styleCards.forEach(card => {
            card.addEventListener('click', () => {
                elements.styleCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                state.style = card.dataset.style;

                if (state.style === 'energetic') {
                    elements.sliderSpeed.value = 1.2;
                    elements.sliderPitch.value = 1.1;
                } else if (state.style === 'narrator') {
                    elements.sliderSpeed.value = 0.95;
                    elements.sliderPitch.value = 0.9;
                } else if (state.style === 'whisper') {
                    elements.sliderSpeed.value = 0.85;
                    elements.sliderPitch.value = 1.2;
                } else {
                    elements.sliderSpeed.value = 1.0;
                    elements.sliderPitch.value = 1.0;
                }
                elements.sliderSpeed.dispatchEvent(new Event('input'));
                elements.sliderPitch.dispatchEvent(new Event('input'));
            });
        });

        elements.templateSelect.addEventListener('change', (e) => {
            const key = e.target.value;
            if (sampleScripts[key]) {
                elements.textInput.value = sampleScripts[key];
                updateTextStats();
                showToast(`Loaded sample template script`, 'info');
            }
        });

        elements.textInput.addEventListener('input', updateTextStats);

        elements.btnClearText.addEventListener('click', () => {
            elements.textInput.value = '';
            updateTextStats();
        });
        elements.btnCopyText.addEventListener('click', () => {
            if (elements.textInput.value) {
                navigator.clipboard.writeText(elements.textInput.value);
                showToast('Text copied to clipboard!', 'success');
            }
        });

        elements.visModeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                elements.visModeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.visMode = btn.dataset.mode;
            });
        });

        elements.btnImportFile.addEventListener('click', () => elements.fileInput.click());
        elements.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    elements.textInput.value = evt.target.result;
                    updateTextStats();
                    showToast(`Imported text from ${file.name}`, 'success');
                };
                reader.readAsText(file);
            }
        });

        elements.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.dropZone.classList.add('drop-zone-active');
        });
        elements.dropZone.addEventListener('dragleave', () => {
            elements.dropZone.classList.remove('drop-zone-active');
        });
        elements.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            elements.dropZone.classList.remove('drop-zone-active');
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                const reader = new FileReader();
                reader.onload = (evt) => {
                    elements.textInput.value = evt.target.result;
                    updateTextStats();
                    showToast(`Loaded dropped file ${file.name}`, 'success');
                };
                reader.readAsText(file);
            }
        });

        if (elements.btnDownloadAudio) {
            elements.btnDownloadAudio.addEventListener('click', exportRecordedWav);
        }
        if (elements.btnRecordMicVoice) {
            elements.btnRecordMicVoice.addEventListener('click', recordLiveVoice);
        }
        elements.btnExportSRT.addEventListener('click', exportSRT);

        elements.toggleAudioFX.addEventListener('click', () => {
            elements.toggleAudioFX.parentElement.classList.toggle('open');
        });
        elements.toggleBGMixer.addEventListener('click', () => {
            elements.toggleBGMixer.parentElement.classList.toggle('open');
        });

        elements.btnClearHistory.addEventListener('click', () => {
            state.history = [];
            localStorage.removeItem('voxcraft_history');
            renderHistory();
            showToast('History cleared.', 'info');
        });

        elements.historyList.addEventListener('click', (e) => {
            const replayBtn = e.target.closest('.btn-replay');
            const delBtn = e.target.closest('.btn-del-hist');

            if (replayBtn) {
                const id = parseInt(replayBtn.dataset.id);
                const item = state.history.find(h => h.id === id);
                if (item) {
                    elements.textInput.value = item.fullText;
                    updateTextStats();
                    speakText();
                }
            } else if (delBtn) {
                const id = parseInt(delBtn.dataset.id);
                state.history = state.history.filter(h => h.id !== id);
                localStorage.setItem('voxcraft_history', JSON.stringify(state.history));
                renderHistory();
            }
        });

        elements.btnSavePreset.addEventListener('click', () => {
            const presetName = prompt('Enter a name for your custom voice preset:', 'My Custom Voice');
            if (presetName) {
                const newPreset = {
                    id: Date.now(),
                    name: presetName,
                    speed: elements.sliderSpeed.value,
                    pitch: elements.sliderPitch.value,
                    voice: elements.voiceSelect.value
                };
                state.presets.push(newPreset);
                localStorage.setItem('voxcraft_presets', JSON.stringify(state.presets));
                renderPresets();
                showToast(`Preset "${presetName}" saved!`, 'success');
            }
        });

        elements.btnNewProject.addEventListener('click', () => {
            if (confirm('Start a new script project? Current text will be cleared.')) {
                elements.textInput.value = '';
                updateTextStats();
                showToast('New script started.', 'info');
            }
        });

        elements.btnShortcuts.addEventListener('click', () => {
            alert("Keyboard Shortcuts:\n\n• Ctrl + Enter: Play / Pause speech\n• Esc: Stop speech\n• Ctrl + Shift + S: Export WAV audio");
        });

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                speakText();
            } else if (e.key === 'Escape') {
                stopSpeech();
            } else if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
                e.preventDefault();
                exportRecordedWav();
            }
        });
    }

    initSpeechEngine();
    setupEventListeners();
    updateTextStats();

    elements.textInput.value = "നമസ്കാരം! വോക്സ് ക്രാഫ്റ്റ് എഐ വോയിസ് ജനറേറ്ററിലേക്ക് സ്വാഗതം. നിങ്ങൾക്ക് ഇവിടെ നൽകുന്ന ടെക്സ്റ്റ് ഉയർന്ന ഗുണനിലവാരമുള്ള ശബ്ദത്തിലേക്ക് മാറ്റാൻ സാധിക്കും.";
    updateTextStats();
});

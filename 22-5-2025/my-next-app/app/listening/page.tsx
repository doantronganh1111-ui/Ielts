'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Header from '../components/Header';

interface Question {
  question: string;
  options?: string[];
  correctIndex?: number | null;
}

const ReadingPage: React.FC = () => {
  const [paragraph, setParagraph] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [model, setModel] = useState<string>('gpt-4-1106-preview');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speechActive, setSpeechActive] = useState<boolean>(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number>(0);
  const [lastChunkIndex, setLastChunkIndex] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(0.85);
  const [difficulty, setDifficulty] = useState<string>('Easy');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const chunksRef = useRef<string[]>([]);

  // New states for quiz answers and UI
  const [answers, setAnswers] = useState<number[]>([]); // -1 means unanswered
  const [showScore, setShowScore] = useState<boolean>(false);
  const [score, setScore] = useState<{ correct: number; incorrect: number }>({ correct: 0, incorrect: 0 });
  const [started, setStarted] = useState<boolean>(false); // whether user started the test (clicked Task)
  const [showParagraph, setShowParagraph] = useState<boolean>(false); // toggle to show/hide generated paragraph

  // Load voices (client-only)
  useEffect(() => {
    const fetchVoices = () => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      const availableVoices = window.speechSynthesis.getVoices() || [];
      const englishVoices = availableVoices.filter((voice) => voice.lang && voice.lang.startsWith('en'));
      setVoices(englishVoices);
      // set a default voice if none selected yet
      if (!selectedVoice && englishVoices.length > 0) setSelectedVoice(englishVoices[0]);
    };

    fetchVoices();
    if (typeof window !== 'undefined' && (window.speechSynthesis as any).onvoiceschanged !== undefined) {
      (window.speechSynthesis as any).onvoiceschanged = fetchVoices;
    }
  }, [selectedVoice]);

  // ✅ Thêm 2 dòng này
  const lastChunkIndexRef = useRef<number>(0);
  useEffect(() => {
    lastChunkIndexRef.current = lastChunkIndex;
  }, [lastChunkIndex]);
  useEffect(() => {
    let cancelled = false;

    const splitIntoChunks = (text: string, chunkSize: number) => {
      const sentences = text.match(/[^.!?,;:]+[.!?,;:]?/g) || [text];
      const chunks: string[] = [];
      let currentChunk = "";

      for (const sentence of sentences) {
        const trial = (currentChunk + " " + sentence).trim();
        const wordCount = trial.split(/\s+/).filter(Boolean).length;

        if (wordCount > chunkSize) {
          if (currentChunk.trim() !== "") chunks.push(currentChunk.trim());
          currentChunk = sentence.trim();
        } else {
          currentChunk = trial;
        }

        if (/[.!?,;:]$/.test(sentence.trim())) {
          if (currentChunk.trim() !== "") {
            chunks.push(currentChunk.trim());
            currentChunk = "";
          }
        }
      }

      if (currentChunk.trim() !== "") chunks.push(currentChunk.trim());
      return chunks;
    };

    const speakParagraphAsync = async () => {
      if (!paragraph || !selectedVoice) return;

      const chunks = splitIntoChunks(paragraph, 50);
      chunksRef.current = chunks;

      const startIndex = Math.max(0, lastChunkIndexRef.current || 0);

      for (let i = startIndex; i < chunks.length; i++) {
        if (cancelled) break;
        if (!speechActive) break;

        const chunk = chunks[i];
        setCurrentChunkIndex(i);

        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
        utterance.pitch = 1;
        utterance.rate = speed;
        utterance.volume = 1;

        utteranceRef.current = utterance;

        // cờ khi utterance kết thúc/ lỗi
        let finished = false;
        utterance.onend = () => { finished = true; };
        utterance.onerror = () => { finished = true; };

        // bắt đầu đọc (không cancel() ở đây)
        window.speechSynthesis.speak(utterance);

        // chờ utterance hoàn thành hoặc có cancel
        await new Promise<void>((resolve) => {
          const check = () => {
            if (finished || cancelled || !speechActive) {
              resolve();
            } else {
              setTimeout(check, 50);
            }
          };
          check();
        });

        // cập nhật last index
        setLastChunkIndex(i);

        if (cancelled || !speechActive) {
          window.speechSynthesis.cancel();
          break;
        }

        // nếu là chunk cuối → dừng hẳn
        if (i === chunks.length - 1) {
          setSpeechActive(false);
          setCurrentChunkIndex(0);
          setLastChunkIndex(0);
          window.speechSynthesis.cancel();
          break;
        }

        // tính delay dựa vào dấu cuối và tốc độ đọc
        const match = chunk.trim().match(/[.!?,;:]$/);
        let delay = 300; // default 300ms
        if (match) {
          const symbol = match[0];
          if (symbol === '.' || symbol === '!' || symbol === '?') delay = 350;
          else if (symbol === ',' || symbol === ';' || symbol === ':') delay = 150;
        }
        // điều chỉnh theo tốc độ nói: speed <1 => tăng pause, speed>1 => giảm pause
        const adjustedDelay = Math.max(50, Math.round(delay / (speed || 1)));

        await new Promise((r) => setTimeout(r, adjustedDelay));
      }
    };

    if (speechActive) {
      speakParagraphAsync().catch((e) => {
        console.error("Speech error:", e);
      });
    }

    return () => {
      cancelled = true;
      try { window.speechSynthesis.cancel(); } catch (e) { }
    };
  }, [paragraph, selectedVoice, speechActive, speed]);

  // Fetch reading material from backend
  const fetchReadingMaterial = async (task: string) => {
    setLoading(true);
    setShowScore(false);
    setScore({ correct: 0, incorrect: 0 });
    setStarted(true); // user started the test
    setShowParagraph(false); // IMPORTANT: when the test starts, paragraph must NOT be shown

    try {
      const response = await axios.post('http://localhost:5000/api/generate-reading-material', {
        model,
        task,
        difficulty,
        prompt: `
    Generate a reading comprehension passage for IELTS at ${difficulty} level.
    Then create 5 multiple choice questions based on it.
    Each question should have exactly 4 options labeled A, B, C, D.
    Return the result as a JSON object with the structure:
    {
      "paragraph": "...",
      "questions": [
        {
          "question": "...",
          "options": ["...", "...", "...", "..."],
          "correctIndex": 1   // the index (0-based) of the correct answer
        }
      ]
    }
    Make sure the JSON is valid and includes the correctIndex field for grading.
    `,
      });


      // Response shape is expected to include paragraph and questions[]
      const respParagraph: string = response.data.paragraph ?? '';
      const respQuestions: any[] = response.data.questions ?? [];

      // Normalize questions and try to detect a correctIndex in several common shapes
      const normalized: Question[] = respQuestions.map((q: any) => {
        const opts: string[] | undefined = Array.isArray(q.options) ? q.options : undefined;

        let correctIndex: number | null = null;

        // check common fields that backends might return
        if (typeof q.correctIndex === 'number') {
          correctIndex = q.correctIndex;
        } else if (typeof q.correct === 'number') {
          correctIndex = q.correct;
        } else if (typeof q.answer === 'number') {
          correctIndex = q.answer;
        } else if (typeof q.correct === 'string') {
          const letter = q.correct.trim().toUpperCase();
          // if it's a letter like 'A'/'B'... convert to index
          if (letter.length === 1 && letter >= 'A' && letter <= 'Z') {
            const idx = letter.charCodeAt(0) - 65;
            if (opts && idx >= 0 && idx < opts.length) correctIndex = idx;
          }
          // if it's the full text of an option, find it
          if (correctIndex === null && opts) {
            const idx = opts.findIndex((opt) => opt.trim().toLowerCase() === q.correct.trim().toLowerCase());
            if (idx !== -1) correctIndex = idx;
          }
        } else if (typeof q.answer === 'string' && opts) {
          const letter = q.answer.trim().toUpperCase();
          if (letter.length === 1 && letter >= 'A' && letter <= 'Z') {
            const idx = letter.charCodeAt(0) - 65;
            if (idx >= 0 && idx < opts.length) correctIndex = idx;
          } else {
            const idx = opts.findIndex((opt) => opt.trim().toLowerCase() === q.answer.trim().toLowerCase());
            if (idx !== -1) correctIndex = idx;
          }
        }

        return {
          question: q.question ?? q.title ?? String(q),
          options: opts,
          correctIndex,
        } as Question;
      });

      setParagraph(respParagraph);
      setQuestions(normalized);
      setAnswers(Array(normalized.length).fill(-1));
      setLoading(false);

      // Stop any speech when new material arrives
      stopSpeech();
    } catch (error) {
      console.error('Error fetching reading material:', error);
      setLoading(false);
    }
  };

  const handleSelectVoice = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedVoiceName = event.target.value;
    const voice = voices.find((v) => v.name === selectedVoiceName) ?? null;
    if (speechActive) stopSpeech();
    setSelectedVoice(voice);
  };

  const handleStopOrContinueSpeech = () => {
    if (speechActive) stopSpeech();
    else continueSpeech();
  };

  const stopSpeech = () => {
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      window.speechSynthesis.cancel();
    }
    setSpeechActive(false);
  };

  const continueSpeech = () => {
    if (!paragraph) return;
    // If speechSynthesis is paused, resume. If never started, start from lastChunkIndex.
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setSpeechActive(true);
      } else {
        // start speaking from last chunk index (this will be handled by effect)
        setLastChunkIndex((prev) => prev);
        setSpeechActive(true);
      }
    } catch (err) {
      // ignore
    }
  };

  const handleSpeedChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseFloat(event.target.value);
    setSpeed(newSpeed);
    if (speechActive) {
      stopSpeech();
      continueSpeech();
    }
  };

  const handleDifficultyChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setDifficulty(event.target.value);
  };

  // small hack to warm up voices in some browsers
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const initialSpeech = new SpeechSynthesisUtterance('');
    try {
      window.speechSynthesis.speak(initialSpeech);
    } catch (e) {
      // ignore
    }
  }, []);

  // Option selection handler
  const handleSelectOption = (questionIndex: number, optionIndex: number) => {
    if (showScore) return; // prevent changes after submit
    setAnswers((prev) => {
      const copy = [...prev];
      copy[questionIndex] = optionIndex;
      return copy;
    });
  };

  // Submit and grade
  const handleSubmit = () => {
    if (questions.length === 0) return;
    let correct = 0;
    let ungradable = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const selected = answers[i];
      if (q.correctIndex == null) {
        ungradable++;
        continue; // can't grade
      }
      if (selected === q.correctIndex) correct++;
    }

    const incorrect = questions.length - correct - ungradable;
    setScore({ correct, incorrect });
    setShowScore(true);
  };

  const handleReset = () => {
    setAnswers(Array(questions.length).fill(-1));
    setShowScore(false);
    setScore({ correct: 0, incorrect: 0 });
    setStarted(false);
    setShowParagraph(false);
  };

  const toggleShowParagraph = () => {
    setShowParagraph((s) => !s);
  };

  return (
    <div className="flex flex-col">
      <Header />
      <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">IELTS Listening Practice</h1>

        {/* Buttons for tasks */}
        <div className="flex space-x-4">
          {[1, 2, 3, 4].map((task) => (
            <button
              key={task}
              onClick={() => fetchReadingMaterial(`task${task}`)}
              disabled={loading}
              className="bg-blue-500 text-white px-6 py-3 rounded-md shadow-md hover:bg-blue-600 transition duration-300 disabled:opacity-50"
            >
              {loading ? 'Generating...' : `Task ${task}`}
            </button>
          ))}
        </div>

        {/* Voice selection */}
        <div className="mt-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Select Voice</h2>
          <select onChange={handleSelectVoice} value={selectedVoice?.name ?? ''} className="px-4 py-2 rounded bg-gray-300 text-black">
            <option value="">Select a voice</option>
            {voices.map((voice, index) => (
              <option key={index} value={voice.name}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
        </div>

        {/* Speed */}
        <div className="mt-6">
          <label htmlFor="speed" className="text-xl font-semibold text-gray-800 mb-2 block">
            Adjust Speed:
          </label>
          <input
            type="range"
            id="speed"
            name="speed"
            min="0.5"
            max="1.8"
            step="0.1"
            value={speed}
            onChange={handleSpeedChange}
            className="w-64"
          />
          <span className="text-gray-700 ml-2">{speed.toFixed(1)}x</span>
        </div>

        {/* Difficulty */}
        <div className="mt-6">
          <label htmlFor="difficulty" className="text-xl font-semibold text-gray-800 mb-2 block">
            Select Difficulty:
          </label>
          <select
            id="difficulty"
            name="difficulty"
            value={difficulty}
            onChange={handleDifficultyChange}
            className="px-4 py-2 rounded bg-gray-300 text-black"
          >
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </div>

        {/* Control and paragraph toggle */}
        <div className="mt-6 flex items-center space-x-4">
          <button
            onClick={handleStopOrContinueSpeech}
            disabled={loading}
            className={`px-6 py-3 rounded-md shadow-md ${speechActive ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
              } hover:bg-red-600 transition duration-300`}
          >
            {loading ? 'Generating...' : speechActive ? 'Stop Speaking' : 'Continue Speaking'}
          </button>

          {/* Show Paragraph button - user requested to add */}
          {paragraph && (
            <button
              onClick={toggleShowParagraph}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white shadow-md hover:bg-indigo-700 transition duration-200"
            >
              {showParagraph ? 'Hide Paragraph' : 'Show Generated Paragraph'}
            </button>
          )}

          {/* Submit / Reset controls for the quiz */}
          {questions.length > 0 && (
            <>
              <button
                onClick={handleSubmit}
                disabled={showScore}
                className="px-4 py-2 rounded-md bg-blue-600 text-white shadow-md hover:bg-blue-700 transition duration-200"
              >
                Submit Answers
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-md bg-gray-300 text-black shadow-md hover:bg-gray-400 transition duration-200"
              >
                Reset / Retake
              </button>
            </>
          )}
        </div>

        {/* Paragraph: only show if user toggled it visible AND not in the middle of starting the test (we already hide when started) */}
        {showParagraph && paragraph && (
          <div className="mt-10 max-w-3xl bg-white shadow-md rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Generated Paragraph</h2>
            <p className="text-gray-700">{paragraph}</p>
          </div>
        )}

        {/* Questions: show always after questions are available */}
        {questions.length > 0 && (
          <div className="mt-10 max-w-3xl bg-white shadow-md rounded-lg p-6 w-full">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Questions</h2>
            {questions.map((q, qi) => (
              <div key={qi} className="mb-6">
                <p className="text-gray-700 font-medium mb-3">
                  {qi + 1}. {q.question}
                </p>

                {/* Options with letter buttons */}
                <ul className="space-y-2">
                  {q.options?.map((opt, oi) => {
                    const letter = String.fromCharCode(65 + oi);
                    const isSelected = answers[qi] === oi;

                    // After submission, optionally mark correct/incorrect visually
                    const showCorrect = showScore && q.correctIndex != null && q.correctIndex === oi;
                    const showWrong = showScore && answers[qi] === oi && q.correctIndex != null && q.correctIndex !== oi;

                    return (
                      <li key={oi} className="flex items-center">
                        <button
                          onClick={() => handleSelectOption(qi, oi)}
                          disabled={showScore} // prevent changes after submit
                          aria-pressed={isSelected}
                          className={`w-10 h-10 rounded-full mr-4 flex items-center justify-center font-semibold border-2 transition-all focus:outline-none ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-black border-gray-300'
                            } ${showCorrect ? 'ring-4 ring-green-200' : ''} ${showWrong ? 'ring-4 ring-red-200' : ''}`}
                        >
                          {letter}
                        </button>

                        <span className={`flex-1 text-left ${showCorrect ? 'font-semibold' : ''}`}>{opt}</span>

                        {/* if showScore, show a small label */}
                        {showScore && q.correctIndex == null && (
                          <span className="ml-3 text-sm text-gray-500">(No answer provided for grading)</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {/* Score display centered and emphasized */}
            {showScore && (
              <div className="mt-6 flex flex-col items-center justify-center">
                <div className="bg-green-500 text-white rounded-full px-8 py-6 text-center transform scale-105 shadow-lg">
                  <div className="text-3xl md:text-4xl font-bold">{score.correct} / {questions.length} correct</div>
                </div>
                <div className="mt-3 text-gray-700">Incorrect: {score.incorrect}</div>
                {questions.some((q) => q.correctIndex == null) && (
                  <div className="mt-2 text-sm text-yellow-700">Some questions could not be graded because the correct answer wasn't available from the backend.</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReadingPage;

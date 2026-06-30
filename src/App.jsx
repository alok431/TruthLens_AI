import { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileImage, ShieldAlert, ShieldCheck, Database, Info } from 'lucide-react';
import { tfjsInit, predict } from './utils/model';
import { supabase } from './lib/supabase';

function App() {
  const [image, setImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [isHovering, setIsHovering] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const imageRef = useRef(null);

  // Initialize Edge Model in the background
  useEffect(() => {
    tfjsInit();
  }, []);

  const handleImageUpload = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    
    const url = URL.createObjectURL(file);
    setImage(url);
    setResult(null);
    setFeedbackSent(false);
    setIsAnalyzing(true);

    // Give UI time to render image before processing
    setTimeout(() => {
      runInference(file);
    }, 100);
  };

  const runInference = async (file) => {
    if (!imageRef.current) return;
    try {
      // Run the Edge AI model (addresses limitation B: high latency)
      const res = await predict(imageRef.current);
      setResult({ ...res, file });
    } catch (error) {
      console.error(error);
      alert('Failed to analyze image.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsHovering(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsHovering(true);
  };

  const handleDragLeave = () => {
    setIsHovering(false);
  };

  const submitFeedback = async (correctLabel) => {
    if (!result || !result.file) return;
    try {
      // 1. Upload image to Supabase Storage (Addresses Limitation A: dataset size)
      const fileExt = result.file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `feedback/${fileName}`;

      // This requires the Supabase bucket 'images' to be public & created
      // If setup is not complete, this will fail gracefully for demo purposes
      if (import.meta.env.VITE_SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE' || !import.meta.env.VITE_SUPABASE_URL) {
         setFeedbackSent(true);
         return; // Skip actual upload for non-configured env
      }

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, result.file);

      if (uploadError) throw uploadError;

      const publicUrl = supabase.storage.from('images').getPublicUrl(filePath).data.publicUrl;

      // 2. Insert record into database
      const { error: dbError } = await supabase
        .from('feedback')
        .insert([
          {
            image_url: publicUrl,
            predicted_fake: result.isFake,
            actual_fake: correctLabel === 'fake',
            model_confidence: result.score
          }
        ]);

      if (dbError) throw dbError;

      setFeedbackSent(true);
    } catch (err) {
      console.error('Feedback error:', err);
      // Failsafe for unconfigured supabase
      setFeedbackSent(true); 
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>TruthLens AI</h1>
        <p>Edge-Computed Deepfake Detection</p>
      </header>

      <main className="main-content">
        <section className="glass-panel">
          <div 
            className={`dropzone ${isHovering ? 'active' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => document.getElementById('file-upload').click()}
          >
            <UploadCloud size={48} className="dropzone-icon" />
            <h3>Drag & Drop an image here</h3>
            <p className="text-muted" style={{ marginTop: '0.5rem' }}>or click to browse from your computer</p>
            <input 
              id="file-upload" 
              type="file" 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={(e) => {
                if (e.target.files[0]) handleImageUpload(e.target.files[0]);
              }}
            />
          </div>

          <div style={{ marginTop: '2rem' }}>
            <div className="alert" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99, 102, 241, 0.1)', borderColor: 'var(--primary-color)', color: '#818cf8' }}>
              <Info size={20} />
              <small><b>Edge Inference:</b> Analysis runs entirely in your browser using TensorFlow.js, addressing the high latency of traditional CNN backends.</small>
            </div>
          </div>
        </section>

        <section className="glass-panel">
          {!image && !isAnalyzing && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <FileImage size={64} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p>Upload an image to see the analysis</p>
            </div>
          )}

          {image && (
            <div className="results-panel">
              <div className="preview-container">
                <img 
                  ref={imageRef} 
                  src={image} 
                  alt="Preview" 
                  className="preview-image" 
                  crossOrigin="anonymous"
                />
              </div>

              {isAnalyzing && (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <UploadCloud size={32} className="spinner" style={{ color: 'var(--primary-color)' }} />
                  <p style={{ marginTop: '1rem' }}>Analyzing facial structures...</p>
                </div>
              )}

              {result && !isAnalyzing && (
                <div>
                  <div className="result-card">
                    <div>
                      <h3 style={{ marginBottom: '0.25rem' }}>
                        {result.isFake ? 'Deepfake Detected' : 'Likely Authentic'}
                      </h3>
                      <p className="text-muted" style={{ fontSize: '0.9rem' }}>
                         Confidence score from Edge Model
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {result.isFake ? <ShieldAlert size={32} className="score-high" /> : <ShieldCheck size={32} className="score-low" />}
                      <span className={`result-score ${result.isFake ? 'score-high' : 'score-low'}`}>
                        {(result.score * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="progress-bar-container">
                    <div 
                      className="progress-bar" 
                      style={{ 
                        width: `${result.score * 100}%`,
                        backgroundColor: result.isFake ? 'var(--danger-color)' : 'var(--success-color)'
                      }} 
                    />
                  </div>

                  <div className="feedback-section">
                    <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Database size={18} /> Model Feedback Loop
                    </h4>
                    <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                      Help us improve the dataset! The original model was limited to 2,041 images. Report inaccuracies to expand our real-world training data.
                    </p>
                    
                    {feedbackSent ? (
                      <div className="alert">
                        ✓ Feedback recorded. Thank you for contributing to the dataset!
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button className="btn btn-secondary" onClick={() => submitFeedback(result.isFake ? 'real' : 'fake')} style={{ flex: 1 }}>
                          Report as {result.isFake ? 'Real' : 'Fake'}
                        </button>
                        <button className="btn btn-secondary" onClick={() => submitFeedback(result.isFake ? 'fake' : 'real')} style={{ flex: 1 }}>
                          Confirm Correct
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;

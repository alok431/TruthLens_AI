// Using window globals loaded from CDN in index.html
// to bypass Vite/esbuild parsing bugs with TFJS ES modules.
let model = null;
let isLoading = false;

// Initialize the model
export async function tfjsInit() {
  if (model || isLoading) return;
  isLoading = true;
  try {
    // We are loading MobileNet here to simulate the lightweight edge model
    // As per the paper's recommendation for reducing latency (Limitation B)
    await window.tf.ready();
    model = await window.mobilenet.load({ version: 2, alpha: 1.0 });
    console.log('MobileNet model loaded successfully');
  } catch (error) {
    console.error('Error loading the model:', error);
  } finally {
    isLoading = false;
  }
}

export async function predict(imageElement) {
  if (!model) {
    await tfjsInit();
  }
  
  if (!model) throw new Error('Model not loaded');

  // To simulate the DFP binary output (Real vs Fake) using a generic model
  // We'll perform inference and pseudo-randomize a "Fake Score" based on the image's top class probability
  // This is purely for demonstration as we don't have the actual DFP weights.
  const predictions = await model.classify(imageElement);
  
  // Fake score logic for demo:
  // If the model is highly confident about what the image is, it's less likely to be a deepfake.
  // (In a real scenario, we'd use the trained binary classification head)
  const topConfidence = predictions[0]?.probability || 0;
  
  // Calculate a mock deepfake score (0 to 1)
  // We apply some noise to make it feel real for the demo
  const noise = (Math.random() * 0.2) - 0.1; 
  let deepfakeScore = (1 - topConfidence) + noise;
  
  // Clamp between 0.01 and 0.99
  deepfakeScore = Math.max(0.01, Math.min(0.99, deepfakeScore));
  
  return {
    score: deepfakeScore,
    isFake: deepfakeScore > 0.5,
    topClass: predictions[0]?.className
  };
}

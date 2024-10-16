import wavefile from "wavefile";

export async function read_audio(url, sampling_rate = 16000) {
  const buffer = Buffer.from(await fetch(url).then((x) => x.arrayBuffer()));

  // Read .wav file and convert it to required format
  const wav = new wavefile.WaveFile(buffer);
  wav.toBitDepth("32f");
  wav.toSampleRate(sampling_rate);
  let samples = wav.getSamples();
  if (Array.isArray(samples)) {
    if (samples.length > 1) {
      const SCALING_FACTOR = Math.sqrt(2);

      // Merge channels (into first channel to save memory)
      for (let i = 0; i < samples[0].length; ++i) {
        samples[0][i] = (SCALING_FACTOR * (samples[0][i] + samples[1][i])) / 2;
      }
    }

    // Select first channel
    samples = samples[0];
  }
  return samples;
}

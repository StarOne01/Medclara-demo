/**
 * Audio processing utilities for the Scribe feature
 */

/**
 * Converts an AudioBuffer to a WAV format ArrayBuffer
 * @param buffer - The AudioBuffer to convert
 * @returns ArrayBuffer containing WAV file data
 */
export function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const length = buffer.length;
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numberOfChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Convert float samples to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

/**
 * Cuts (removes) a portion of audio between two time points
 * @param audioBlob - The original audio blob
 * @param startTime - Start time in seconds for the cut
 * @param endTime - End time in seconds for the cut
 * @returns Promise<Blob> containing the edited audio
 */
export async function cutAudioSegment(
  audioBlob: Blob,
  startTime: number,
  endTime: number
): Promise<Blob> {
  const audioContext = new AudioContext();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const sampleRate = audioBuffer.sampleRate;
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor(endTime * sampleRate);
  const totalSamples = audioBuffer.length;

  // Calculate new buffer length: everything before selection + everything after selection
  const newLength = startSample + (totalSamples - endSample);
  const newBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    newLength,
    sampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const oldData = audioBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);

    // Copy everything before the selection
    for (let i = 0; i < startSample; i++) {
      newData[i] = oldData[i];
    }

    // Copy everything after the selection
    for (let i = endSample; i < totalSamples; i++) {
      newData[startSample + (i - endSample)] = oldData[i];
    }
  }

  // Convert back to blob
  const wavBuffer = audioBufferToWav(newBuffer);
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

/**
 * Trims audio to keep only the specified range
 * @param audioBlob - The original audio blob
 * @param startTime - Start time in seconds
 * @param endTime - End time in seconds  
 * @returns Promise<Blob> containing the trimmed audio
 */
export async function trimAudio(
  audioBlob: Blob,
  startTime: number,
  endTime: number
): Promise<Blob> {
  const audioContext = new AudioContext();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const sampleRate = audioBuffer.sampleRate;
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor(endTime * sampleRate);

  const newLength = endSample - startSample;
  const newBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    newLength,
    sampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const oldData = audioBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);

    for (let i = 0; i < newLength; i++) {
      newData[i] = oldData[startSample + i];
    }
  }

  const wavBuffer = audioBufferToWav(newBuffer);
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

/**
 * Formats recording time in MM:SS format
 * @param seconds - Total seconds
 * @returns Formatted time string
 */
export function formatRecordingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

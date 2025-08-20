import { VoiceActivationSettings } from './types';

export const formatConnectionQuality = (quality: string): string => {
  switch (quality) {
    case 'excellent':
      return 'Excellent';
    case 'good':
      return 'Good';
    case 'poor':
      return 'Poor';
    default:
      return 'Unknown';
  }
};

export const getConnectionQualityColor = (quality: string): string => {
  switch (quality) {
    case 'excellent':
      return 'text-green-500';
    case 'good':
      return 'text-yellow-500';
    case 'poor':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
};

export const getVADPreset = (preset: 'sensitive' | 'normal' | 'robust'): Partial<VoiceActivationSettings> => {
  switch (preset) {
    case 'sensitive':
      return {
        threshold: -50,
        gateThreshold: -70,
        attackTime: 5,
        releaseTime: 50,
      };
    case 'normal':
      return {
        threshold: -45,
        gateThreshold: -60,
        attackTime: 10,
        releaseTime: 100,
      };
    case 'robust':
      return {
        threshold: -35,
        gateThreshold: -50,
        attackTime: 20,
        releaseTime: 200,
      };
  }
};

export const validateVADSettings = (settings: VoiceActivationSettings): boolean => {
  return (
    settings.threshold >= -60 && settings.threshold <= -10 &&
    settings.gateThreshold >= -80 && settings.gateThreshold <= -30 &&
    settings.attackTime >= 1 && settings.attackTime <= 50 &&
    settings.releaseTime >= 50 && settings.releaseTime <= 500
  );
};
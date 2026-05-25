const path = require('path');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': path.resolve(__dirname),
            '@/app': path.resolve(__dirname, 'app'),
            '@/assets': path.resolve(__dirname, 'assets'),
            '@/components': path.resolve(__dirname, 'components'),
            '@/context': path.resolve(__dirname, 'context'),
            '@/hooks': path.resolve(__dirname, 'hooks'),
            '@/lib': path.resolve(__dirname, 'lib'),
            '@/types': path.resolve(__dirname, 'types'),
            '@/utils': path.resolve(__dirname, 'utils'),
            '@/constants': path.resolve(__dirname, 'constants'),
            '@/stores': path.resolve(__dirname, 'stores'),
            '@/services': path.resolve(__dirname, 'services'),
          },
          extensions: ['.ios.ts', '.android.ts', '.ts', '.ios.tsx', '.android.tsx', '.tsx', '.jsx', '.js', '.json'],
        },
      ],
    ],
  };
};

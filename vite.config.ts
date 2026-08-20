import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/quick_dice_game/',
  plugins: [react()],
});

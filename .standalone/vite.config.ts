import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({root:path.resolve('.standalone'),base:'./',plugins:[react()],resolve:{alias:{'@':path.resolve('.')}},build:{outDir:path.resolve('dist-local'),emptyOutDir:true,rolldownOptions:{output:{codeSplitting:false}}}});

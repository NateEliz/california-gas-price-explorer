import {createRoot} from 'react-dom/client';
import Explorer from '../components/explorer';
import '../app/globals.css';
import '../app/explorer.css';
createRoot(document.getElementById('root')!).render(<Explorer/>);

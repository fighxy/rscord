import { AppProviders } from "./app/AppProviders";
import { AppRouter } from "./app/routes";
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', preventDefault);
    document.addEventListener('selectstart', preventDefault);
    document.addEventListener('dragstart', preventDefault);

    return () => {
      document.removeEventListener('contextmenu', preventDefault);
      document.removeEventListener('selectstart', preventDefault);
      document.removeEventListener('dragstart', preventDefault);
    };
  }, []);

  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}

// Добавьте CSS в theme.css для разрешения выбора в инпутах, как выше.

export default App;

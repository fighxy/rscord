import { AppProviders } from "./app/AppProviders";
import { AppRouter } from "./app/routes";
import { useEffect } from "react";

function App() {
  // Отключаем браузерное контекстное меню во всём приложении
  useEffect(() => {
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Отключаем контекстное меню на правый клик
    document.addEventListener('contextmenu', preventContextMenu);
    
    // Отключаем выделение текста
    document.addEventListener('selectstart', (e) => e.preventDefault());
    
    // Отключаем перетаскивание элементов
    document.addEventListener('dragstart', (e) => e.preventDefault());

    return () => {
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('selectstart', (e) => e.preventDefault());
      document.removeEventListener('dragstart', (e) => e.preventDefault());
    };
  }, []);

  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}

export default App;

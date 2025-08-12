import { AppProviders } from "./app/AppProviders";
import { AppRouter } from "./app/routes";

function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}

export default App;

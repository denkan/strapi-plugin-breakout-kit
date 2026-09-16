import { Page } from "@strapi/strapi/admin";
import { Routes, Route } from "react-router-dom";

import { HomePage } from "./HomePage";
import { HooksDemo } from "./HooksDemo";
import { ComponentsDemo } from "./ComponentsDemo";

const App = () => {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="hooks-demo" element={<HooksDemo />} />
      <Route path="components-demo" element={<ComponentsDemo />} />
      <Route path="*" element={<Page.Error />} />
    </Routes>
  );
};

export default App;
import { Page } from "@strapi/strapi/admin";
import { Routes, Route } from "react-router-dom";

import { HomePage } from "./HomePage";
import { HooksDemo } from "./HooksDemo";
import { ComponentsDemo } from "./ComponentsDemo";
import { EditPageDemo } from "./EditPageDemo";

const App = () => {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="hooks-demo" element={<HooksDemo />} />
      <Route path="components-demo" element={<ComponentsDemo />} />
      <Route path="edit-page" element={<EditPageDemo />} />
      <Route path="*" element={<Page.Error />} />
    </Routes>
  );
};

export default App;
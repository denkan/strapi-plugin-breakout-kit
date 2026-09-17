import { Box, Flex, Link } from '@strapi/design-system';
import { Page } from '@strapi/strapi/admin';
import { NavLink, Route, Routes } from 'react-router-dom';

import { ComponentsDemo } from './ComponentsDemo';
import { Diagnostics } from './Diagnostics';
import { DynamicZoneDemo } from './DynamicZoneDemo';
import { EditPageDemo } from './EditPageDemo';
import { HooksDemo } from './HooksDemo';

const Nav = () => (
  <Box paddingLeft={8} paddingTop={4}>
    <Flex gap={4}>
      <Link tag={NavLink} to="">Diagnostics</Link>
      <Link tag={NavLink} to="hooks-demo">Hooks</Link>
      <Link tag={NavLink} to="components-demo">Components</Link>
      <Link tag={NavLink} to="edit-page">EditPage</Link>
      <Link tag={NavLink} to="dz-demo">Dynamic zone</Link>
    </Flex>
  </Box>
);

const App = () => (
  <>
    <Nav />
    <Routes>
      <Route index element={<Diagnostics />} />
      <Route path="hooks-demo" element={<HooksDemo />} />
      <Route path="components-demo" element={<ComponentsDemo />} />
      <Route path="edit-page" element={<EditPageDemo />} />
      <Route path="dz-demo" element={<DynamicZoneDemo />} />
      <Route path="*" element={<Page.Error />} />
    </Routes>
  </>
);

export { App };

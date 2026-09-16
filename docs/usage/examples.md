# Examples

All examples assume the plugin is installed and the Vite helper configured
(see [installation.md](./installation.md)).

## 1. Move a field to the top (custom field placement)

The layout is `EditLayout['layout']`: panels → rows → fields. Transform it on the provider
(applies everywhere) or per `<EditForm>`:

```tsx
const moveFieldToTop = (layout, name) => {
  const rows = layout.flat();
  const target = rows.flatMap((row) => row).find((field) => field.name === name);
  if (!target) return layout;
  const without = layout
    .map((panel) => panel.map((row) => row.filter((f) => f.name !== name)).filter((r) => r.length))
    .filter((panel) => panel.length);
  return [[[{ ...target, size: 12 }]], ...without];
};

<EditPage
  model="api::article.article"
  documentId={id}
  form={{ layout: (layout) => moveFieldToTop(layout, 'title') }}
/>;
```

## 2. Replace one input, keep everything else stock

```tsx
<EditForm
  renderField={(field, Default) =>
    field.name === 'price' ? (
      <MyPriceInput
        label={field.label}
        // read/write through the form context so save/validation keep working:
        // const { value, onChange } = useEditField(field.name)
        name={field.name}
        disabled={field.disabled}
      />
    ) : (
      <Default {...field} />
    )
  }
/>
```

## 3. Controlled mode with external data

Pass values instead of letting the provider fetch. A plain value = controlled (no fetch);
a function = transform of the fetched default.

```tsx
// Fully external document (e.g. from your own API or an in-memory draft):
<DocumentProvider
  model="api::article.article"
  document={myExternalDocument}       // skips the document fetch
  schema={mySchema}                    // optional; else fetched from Strapi
  initialValues={(derived) => ({ ...derived, title: 'Prefilled' })}
>
  <EditForm />
  <DocumentActionsBar include={['save']} />
</DocumentProvider>
```

## 4. Edit in a modal, from anywhere in the admin

```tsx
import { Modal } from '@strapi/design-system';

const EditInModal = ({ model, documentId, onClose }) => (
  <Modal.Root defaultOpen onOpenChange={(open) => !open && onClose()}>
    <Modal.Content style={{ maxWidth: '80vw' }}>
      <Modal.Body>
        <EditPage
          model={model}
          documentId={documentId}
          sidePanels={false}
          header={{ showStatus: true }}
          onDeleted={onClose}
        />
        <DocumentActionsBarPlacement /> {/* or keep sidePanels for the actions card */}
      </Modal.Body>
    </Modal.Content>
  </Modal.Root>
);
```

Tip: with `sidePanels={false}`, render `<DocumentActionsBar include={['save', 'publish']} />`
yourself (inside the provider) wherever the modal's footer should be — every piece works in
any container because nothing reads the router.

## 5. Side-by-side locales

Two providers coexist freely:

```tsx
<Flex gap={4} alignItems="flex-start">
  <DocumentProvider model="api::article.article" documentId={id} locale="en">
    <EditForm />
  </DocumentProvider>
  <DocumentProvider model="api::article.article" documentId={id} locale="sv">
    <EditForm />
  </DocumentProvider>
</Flex>
```

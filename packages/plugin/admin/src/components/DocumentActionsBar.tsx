import * as React from 'react';
import { useIntl } from 'react-intl';

import { DocumentActions, useForm } from '../access';
import { useHeadlessData } from '../data/context';
import { useDocumentOperations } from '../data/operations';
import { usePermissions } from '../data/hooks';

export type ActionType = 'save' | 'publish' | 'unpublish' | 'discard' | 'delete' | 'clone';

interface ActionDescription {
  id: string;
  label: string;
  onClick?: () => void | Promise<unknown>;
  disabled?: boolean;
  variant?: string;
  position?: string;
  dialog?: {
    type: 'dialog';
    title: string;
    content?: React.ReactNode;
    onConfirm: () => void | Promise<unknown>;
    variant?: string;
  };
}

export interface DocumentActionsBarProps {
  include?: ActionType[];
  exclude?: ActionType[];
  renderAction?: (
    description: ActionDescription,
    Default: React.ComponentType<{ actions: ActionDescription[] }>
  ) => React.ReactNode;
}

/**
 * Layer 3: the save/publish/… buttons, rendered with the STOCK DocumentActions renderer
 * (primary button + secondary + overflow menu, confirm dialogs) but backed by the
 * headless operations — no navigation, callbacks fire on the provider instead.
 * Built-in descriptions mirror the stock defaults' enablement rules; guided-tour and
 * telemetry wiring intentionally omitted (docs/decisions.md #3).
 */
export const DocumentActionsBar = ({ include, exclude, renderAction }: DocumentActionsBarProps) => {
  const { hasDraftAndPublish, status, isCreating } = useHeadlessData('DocumentActionsBar');
  const ops = useDocumentOperations();
  // Narrow selectors, NOT useEditForm(): that hook subscribes to the whole values
  // object, which would re-render this bar on every keystroke in the form.
  const modified = useForm('DocumentActionsBar', (state) => state.modified as boolean);
  const isSubmitting = useForm('DocumentActionsBar', (state) => state.isSubmitting as boolean);
  const rbac = usePermissions() as {
    canPublish?: boolean;
    canUpdate?: boolean;
    canDelete?: boolean;
    canCreate?: boolean;
  };
  const { formatMessage } = useIntl();

  const wanted = (type: ActionType) =>
    (include ? include.includes(type) : true) && !(exclude ?? []).includes(type);

  const descriptions: ActionDescription[] = [];

  if (wanted('publish') && hasDraftAndPublish && (rbac.canPublish ?? false)) {
    descriptions.push({
      id: 'publish',
      label: formatMessage({ id: 'app.utils.publish', defaultMessage: 'Publish' }),
      disabled: isSubmitting || status === 'published',
      onClick: () => ops.publish(),
    });
  }

  if (wanted('save') && (isCreating ? (rbac.canCreate ?? false) : (rbac.canUpdate ?? false))) {
    descriptions.push({
      id: 'save',
      label: formatMessage({ id: 'global.save', defaultMessage: 'Save' }),
      // Stock rule: disabled while submitting, when nothing changed, or on the published tab.
      disabled: isSubmitting || (!modified && !isCreating) || status === 'published',
      variant: 'secondary',
      onClick: () => ops.save(),
    });
  }

  if (
    wanted('unpublish') &&
    hasDraftAndPublish &&
    (rbac.canPublish ?? false) &&
    !isCreating
  ) {
    descriptions.push({
      id: 'unpublish',
      label: formatMessage({
        id: 'app.utils.unpublish',
        defaultMessage: 'Unpublish',
      }),
      variant: 'danger',
      dialog: {
        type: 'dialog',
        title: formatMessage({
          id: 'app.components.ConfirmDialog.title',
          defaultMessage: 'Confirmation',
        }),
        content: formatMessage({
          id: 'content-manager.actions.unpublish.dialog.body',
          defaultMessage: 'Are you sure?',
        }),
        onConfirm: () => ops.unpublish(),
      },
    });
  }

  if (wanted('discard') && hasDraftAndPublish && (rbac.canUpdate ?? false) && !isCreating) {
    descriptions.push({
      id: 'discard',
      label: formatMessage({
        id: 'content-manager.actions.discard.label',
        defaultMessage: 'Discard changes',
      }),
      variant: 'danger',
      dialog: {
        type: 'dialog',
        title: formatMessage({
          id: 'app.components.ConfirmDialog.title',
          defaultMessage: 'Confirmation',
        }),
        content: formatMessage({
          id: 'content-manager.actions.discard.dialog.body',
          defaultMessage: 'Are you sure?',
        }),
        onConfirm: () => ops.discard(),
      },
    });
  }

  if (wanted('clone') && !isCreating) {
    descriptions.push({
      id: 'clone',
      label: formatMessage({ id: 'content-manager.actions.clone.label', defaultMessage: 'Duplicate' }),
      onClick: () => ops.clone(),
    });
  }

  if (wanted('delete') && (rbac.canDelete ?? false) && !isCreating) {
    descriptions.push({
      id: 'delete',
      label: formatMessage({
        id: 'content-manager.actions.delete.label',
        defaultMessage: 'Delete entry',
      }),
      variant: 'danger',
      dialog: {
        type: 'dialog',
        title: formatMessage({
          id: 'app.components.ConfirmDialog.title',
          defaultMessage: 'Confirmation',
        }),
        content: formatMessage({
          id: 'content-manager.actions.delete.dialog.body',
          defaultMessage: 'Are you sure?',
        }),
        variant: 'danger',
        onConfirm: () => ops.delete(),
      },
    });
  }

  const Default = DocumentActions as unknown as React.ComponentType<{
    actions: ActionDescription[];
  }>;

  if (renderAction) {
    return (
      <>
        {descriptions.map((description) => (
          <React.Fragment key={description.id}>
            {renderAction(description, Default)}
          </React.Fragment>
        ))}
      </>
    );
  }

  if (descriptions.length === 0) {
    return null;
  }

  return <Default actions={descriptions} />;
};

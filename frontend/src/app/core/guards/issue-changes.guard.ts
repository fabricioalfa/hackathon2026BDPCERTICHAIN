import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { IssueComponent } from '../../features/issue/issue.component';

/**
 * Pide confirmación antes de abandonar el formulario de emisión cuando hay
 * cambios sin guardar (campos editados o documento cargado).
 */
export const issueChangesGuard: CanDeactivateFn<IssueComponent> = (_component, _currentRoute, _currentState, nextState) => {
  const hasChanges = _component.form.dirty || _component.previewUrl !== null;

  // El diálogo de "Certificado emitido" está abierto: la navegación es limpia.
  if (!hasChanges || _component.showResult) {
    return true;
  }

  // Cerrar sesión ya pide confirmación con su propio diálogo (Salir del menubar);
  // saltamos el aviso para no encadenar dos confirmaciones seguidas.
  if (nextState.url.startsWith('/login')) {
    return true;
  }

  const confirmationService = inject(ConfirmationService);

  return new Promise<boolean>((resolve) => {
    confirmationService.confirm({
      key: 'global',
      header: 'Salir sin guardar',
      message: 'Tenés cambios sin registrar. Si salís, se perderán. ¿Deseas continuar?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, salir',
      rejectLabel: 'Quedarme',
      accept: () => resolve(true),
      reject: () => resolve(false)
    });
  });
};

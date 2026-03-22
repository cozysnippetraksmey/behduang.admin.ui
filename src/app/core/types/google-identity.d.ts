// ─── Google Identity Services type declarations ────────────────────────────────
// Minimal typings for the Google Identity Services (GIS) SDK loaded via CDN.
// Source: https://developers.google.com/identity/gsi/web/reference/js-reference

declare namespace google {
  namespace accounts {
    namespace id {
      interface CredentialResponse {
        /** JWT ID token containing the user's identity claims. */
        credential: string;
        select_by: string;
      }

      interface IdConfiguration {
        client_id: string;
        callback: (response: CredentialResponse) => void;
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
        context?: 'signin' | 'signup' | 'use';
      }

      interface GsiButtonConfiguration {
        type?: 'standard' | 'icon';
        theme?: 'outline' | 'filled_blue' | 'filled_black';
        size?: 'large' | 'medium' | 'small';
        text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
        shape?: 'rectangular' | 'pill' | 'circle' | 'square';
        logo_alignment?: 'left' | 'center';
        width?: number;
        locale?: string;
      }

      function initialize(config: IdConfiguration): void;
      function renderButton(parent: HTMLElement, options: GsiButtonConfiguration): void;
      function prompt(): void;
      function disableAutoSelect(): void;
      function revoke(hint: string, callback: () => void): void;
    }
  }
}


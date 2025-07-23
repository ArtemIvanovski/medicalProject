import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html'
})
export class FooterComponent {
  emailForNewsletter = '';

  subscribeNewsletter(): void {
    if (this.emailForNewsletter) {
      // TODO: Реализовать подписку на рассылку
      console.log('Subscribing email:', this.emailForNewsletter);

      // Показать уведомление об успешной подписке
      console.log('Подписка оформлена успешно!');

      this.emailForNewsletter = '';
    }
  }

}
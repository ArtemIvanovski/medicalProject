import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-contact-us',
  templateUrl: './contact-us.component.html',
  styleUrl: './contact-us.component.scss'
})
export class ContactUsComponent implements OnInit {

  constructor(
    private titleService: Title
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Обратная связь');
  }
}

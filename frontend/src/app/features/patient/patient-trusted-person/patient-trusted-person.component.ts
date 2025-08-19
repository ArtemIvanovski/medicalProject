import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-trusted-person',
  templateUrl: './patient-trusted-person.component.html',
  styleUrl: './patient-trusted-person.component.scss'
})
export class PatientTrustedPersonComponent implements OnInit {

  constructor(private titleService: Title) {}

  ngOnInit(): void {
    this.titleService.setTitle('Доверенное лицо');
  }
}

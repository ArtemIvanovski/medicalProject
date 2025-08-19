import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-patient-doctor',
  templateUrl: './patient-doctor.component.html',
  styleUrl: './patient-doctor.component.scss'
})
export class PatientDoctorComponent implements OnInit {

  constructor(private titleService: Title) {}

  ngOnInit(): void {
    this.titleService.setTitle('Доктор');
  }
}

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {PatientService} from "../../../core/services";

interface TrustedPerson {
    id: string;
    first_name: string;
    last_name: string;
    patronymic?: string;
    phone_number?: string;
    email: string;
    avatar_url?: string;
    created_at: string;
}

@Component({
    selector: 'app-patient-restrict-trusted-list',
    templateUrl: './patient-restrict-trusted-list.component.html',
    styleUrls: ['./patient-restrict-trusted-list.component.scss']
})
export class PatientRestrictTrustedListComponent implements OnInit {
    trustedPersons: TrustedPerson[] = [];
    isLoading = true;

    constructor(
        private profileService: PatientService,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.loadTrustedPersons();
    }

    loadTrustedPersons(): void {
        this.profileService.getPatientTrustedPersons().subscribe({
            next: (response) => {
                this.trustedPersons = response.trusted_persons;
                this.isLoading = false;
            },
            error: (error) => {
                console.error('Error loading trusted persons:', error);
                this.isLoading = false;
            }
        });
    }

    navigateToRestrictAccess(person: TrustedPerson): void {
        this.router.navigate(['/patient/restrict-trusted-access', person.id]);
    }

    navigateToInviteTrusted(): void {
        this.router.navigate(['/patient/invite-trusted']);
    }

    getAvatarUrl(person: TrustedPerson): string {
        if (person.avatar_url) {
            const match = person.avatar_url.match(/\/avatar\/([^\/]+)\//);
            if (match && match[1]) {
                return this.profileService.getAvatarUrl(match[1]);
            }
        }
        return 'assets/img/default-avatar.png';
    }

    getTrustedFullName(person: TrustedPerson): string {
        const parts = [person.last_name, person.first_name].filter(Boolean);
        return parts.length > 0 ? parts.join(' ') : 'Нет данных';
    }
}
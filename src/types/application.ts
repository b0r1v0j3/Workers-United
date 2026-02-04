// Types for e-Uprava application data

export interface PersonalData {
    surname: string;
    surname_at_birth: string;
    first_name: string;
    gender: 'male' | 'female';
    date_of_birth: string; // YYYY-MM-DD
    country_of_birth: string;
    city_of_birth: string;
    citizenship: string;
    original_citizenship: string;
    marital_status: 'neozenjenneudata' | 'ozenjenudata' | 'razdvojen' | 'razveden' | 'udovac' | 'drugo';
    father_name: string;
    mother_name: string;
}

export interface SpouseData {
    surname: string;
    surname_at_birth: string;
    first_name: string;
    date_of_birth: string;
    country_of_birth: string;
    city_of_birth: string;
}

export interface ChildData {
    surname: string;
    first_name: string;
    date_of_birth: string;
}

export interface FamilyData {
    has_family: boolean;
    spouse?: SpouseData;
    has_children: boolean;
    children: ChildData[];
}

export interface ApplicationData {
    personal: PersonalData;
    family: FamilyData;
}

// Default empty application data
export const defaultApplicationData: ApplicationData = {
    personal: {
        surname: '',
        surname_at_birth: '',
        first_name: '',
        gender: 'male',
        date_of_birth: '',
        country_of_birth: '',
        city_of_birth: '',
        citizenship: '',
        original_citizenship: '',
        marital_status: 'neozenjenneudata',
        father_name: '',
        mother_name: ''
    },
    family: {
        has_family: false,
        has_children: false,
        children: []
    }
};

# Om

Hämtar upp rapporterad tid i Maya för RAÄ och ger tillbaka en mailtemplate-text med Visby- och Distanstimmar separerat. Kopiera och skicka som mail till berörd person.

# Installation

Klona repot sen

    npm install

# Användning

    ./bin/nilleglad Veckonummer Maya-användarnamn [Maya-lösenord]

# Exempel

    ./bin/nilleglad 16 mrbond

Ger

    Hej, rapport för v16

    Visby: 25h
    Sthlm: 14h
    Tot: 39h

    Mvh

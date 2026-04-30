PREFIX build: <https://w3id.org/databook/ns#>
PREFIX db:    <https://w3id.org/databook/ns#>
PREFIX dct:   <http://purl.org/dc/terms/>
PREFIX foaf:  <http://xmlns.com/foaf/0.1/>
PREFIX owl:   <http://www.w3.org/2002/07/owl#>
PREFIX prov:  <http://www.w3.org/ns/prov#>
PREFIX sd:    <http://www.w3.org/ns/sparql-service-description#>
PREFIX void:  <http://rdfs.org/ns/void#>
PREFIX xsd:   <http://www.w3.org/2001/XMLSchema#>

<https://w3id.org/databook/test/observatory-v1#RoyalObservatory>
        a                <http://www.w3.org/ns/sosa/Platform>;
        <http://www.w3.org/2000/01/rdf-schema#label>
                "Royal Observatory Greenwich"@en;
        dct:created      "1675-10-22"^^xsd:date;
        dct:description  "Primary geodetic reference station"@en;
        <http://www.w3.org/2003/01/geo/wgs84_pos#lat>
                51.4778;
        <http://www.w3.org/2003/01/geo/wgs84_pos#long>
                -0.0015;
        <https://w3id.org/databook/test/observatory-v1#icaoCode>
                "EGLL" .

<https://w3id.org/databook/test/observatory-v1#GravitySensor>
        a       <http://www.w3.org/ns/sosa/Sensor>;
        <http://www.w3.org/2000/01/rdf-schema#label>
                "Absolute Gravity Sensor FG5-X"@en;
        <http://www.w3.org/ns/sosa/isHostedBy>
                <https://w3id.org/databook/test/observatory-v1#RoyalObservatory>;
        <http://www.w3.org/ns/sosa/observes>
                <https://w3id.org/databook/test/observatory-v1#GravitationalAcceleration>;
        <http://www.w3.org/ns/ssn/hasProperty>
                <https://w3id.org/databook/test/observatory-v1#CalibrationStatus>;
        <https://w3id.org/databook/test/observatory-v1#lastCalibrated>
                "2026-01-15"^^xsd:date;
        <https://w3id.org/databook/test/observatory-v1#serialNumber>
                "FG5X-0042" .

<https://w3id.org/databook/test/observatory-v1#GravitationalAcceleration>
        a       <http://www.w3.org/ns/sosa/ObservableProperty>;
        <http://www.w3.org/2000/01/rdf-schema#label>
                "Gravitational acceleration"@en;
        <http://qudt.org/schema/qudt/unit>
                <http://qudt.org/vocab/unit/M-PER-SEC2> .

<https://w3id.org/databook/test/observatory-v1#PressureSensor>
        a       <http://www.w3.org/ns/sosa/Sensor>;
        <http://www.w3.org/2000/01/rdf-schema#label>
                "Vaisala PTB330 Barometer"@en;
        <http://www.w3.org/ns/sosa/isHostedBy>
                <https://w3id.org/databook/test/observatory-v1#RoyalObservatory>;
        <http://www.w3.org/ns/sosa/observes>
                <https://w3id.org/databook/test/observatory-v1#AtmosphericPressure>;
        <https://w3id.org/databook/test/observatory-v1#lastCalibrated>
                "2026-02-01"^^xsd:date;
        <https://w3id.org/databook/test/observatory-v1#serialNumber>
                "PTB330-117" .

<https://w3id.org/databook/test/observatory-v1#AtmosphericPressure>
        a       <http://www.w3.org/ns/sosa/ObservableProperty>;
        <http://www.w3.org/2000/01/rdf-schema#label>
                "Atmospheric pressure"@en;
        <http://qudt.org/schema/qudt/unit>
                <http://qudt.org/vocab/unit/HectoPA> .

<https://w3id.org/databook/test/observatory-v1#TiltSensor>
        a       <http://www.w3.org/ns/sosa/Sensor>;
        <http://www.w3.org/2000/01/rdf-schema#label>
                "Lippmann Tiltmeter LT-3"@en;
        <http://www.w3.org/ns/sosa/isHostedBy>
                <https://w3id.org/databook/test/observatory-v1#RoyalObservatory>;
        <http://www.w3.org/ns/sosa/observes>
                <https://w3id.org/databook/test/observatory-v1#EarthTilt>;
        <https://w3id.org/databook/test/observatory-v1#serialNumber>
                "LT3-2088" .

<https://w3id.org/databook/test/observatory-v1#EarthTilt>
        a       <http://www.w3.org/ns/sosa/ObservableProperty>;
        <http://www.w3.org/2000/01/rdf-schema#label>
                "Earth tilt / polar motion"@en;
        <http://qudt.org/schema/qudt/unit>
                <http://qudt.org/vocab/unit/MicroRAD> .

<https://w3id.org/databook/test/observatory-v1#Obs20260422T0900Z>
        a       <http://www.w3.org/ns/sosa/Observation>;
        <http://www.w3.org/ns/sosa/hasSimpleResult>
                9.81185;
        <http://www.w3.org/ns/sosa/madeBySensor>
                <https://w3id.org/databook/test/observatory-v1#GravitySensor>;
        <http://www.w3.org/ns/sosa/observedProperty>
                <https://w3id.org/databook/test/observatory-v1#GravitationalAcceleration>;
        <http://www.w3.org/ns/sosa/resultTime>
                "2026-04-22T09:00:00Z"^^xsd:dateTime .

<https://w3id.org/databook/test/observatory-v1#Obs20260422T0901Z>
        a       <http://www.w3.org/ns/sosa/Observation>;
        <http://www.w3.org/ns/sosa/hasSimpleResult>
                1013.2;
        <http://www.w3.org/ns/sosa/madeBySensor>
                <https://w3id.org/databook/test/observatory-v1#PressureSensor>;
        <http://www.w3.org/ns/sosa/observedProperty>
                <https://w3id.org/databook/test/observatory-v1#AtmosphericPressure>;
        <http://www.w3.org/ns/sosa/resultTime>
                "2026-04-22T09:01:00Z"^^xsd:dateTime .

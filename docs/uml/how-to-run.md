# How to run PlantUML

The diagrams have been split into individual files in the `diagrams/code` directory. 
To generate the diagram images and save them into the `diagrams/photos` directory, run the following command:

```bash
java -jar plantuml.jar "diagrams/code/*.puml" -o "../photos"
```

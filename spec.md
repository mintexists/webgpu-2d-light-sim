# the lines
should have
- start vec2f
- end vec2f
- reflectivity number from 0-1 - probably a float
- i think thats it woo

# the light rays
should have
- wavelength
- one vec2 for position
- one vec2 for direction ~~use either another vec2 for the direction or use just a float for an angle - honestly depends on how the math works for that vector stuff~~



# the processing of stuff
- one gpu work for each rays
- iterates over every collision with every thing
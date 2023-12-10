const artist = (sequelize, DataTypes) => {
  const Artist = sequelize.define('artist', {
    name: {
      type: DataTypes.STRING,
      unique: false,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    artist_id: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    image_url: {
      type: DataTypes.STRING,
      unique: false,
      allowNull: true,
    }
  });

  Artist.findById = async (id) => {
    return await Artist.findOne({
      where: { id: id },
    });
  };
 
  return Artist;
};
 
export default artist;

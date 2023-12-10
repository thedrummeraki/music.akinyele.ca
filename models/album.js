const album = (sequelize, DataTypes) => {
  const Album = sequelize.define('album', {
    name: {
      type: DataTypes.STRING,
      unique: false,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    album_id: {
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
 
  return Album;
};
 
export default album;
